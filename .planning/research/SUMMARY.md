# Project Research Summary

**Project:** HealthConnect — Healthcare Telemedicine Marketplace
**Domain:** Multi-sided healthcare marketplace (patients, doctors, pharmacists, admins)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

HealthConnect is a multi-sided telemedicine marketplace that spans four distinct roles — patients, doctors, pharmacists, and admins — and must deliver an end-to-end healthcare loop: patient discovers a doctor, books and pays for a consultation, receives care via real-time chat with escalation to audio/video, obtains a digital prescription, and then purchases medicines from an integrated pharmacy without ever leaving the platform. This full-circle model (chat-first consultation + dual pharmacy) is genuinely differentiated from incumbents like Teladoc and ZocDoc, which stop at prescription generation and hand off to external pharmacies. Research confirms the approach is technically sound and architecturally buildable with the mandated stack (FastAPI, Next.js, PostgreSQL), but the complexity is non-trivial — particularly around real-time communication, prescription security, and marketplace payment splits.

The recommended approach is a layered monolith with clear domain service boundaries: FastAPI handles all REST API and WebSocket concerns in a router-service-repository pattern; Next.js uses App Router route groups for per-role UIs; PostgreSQL is the primary store with Redis as the cross-worker message bus and cache. WebRTC is delivered peer-to-peer with FastAPI acting purely as a signaling relay — media never passes through the server. The key architectural differentiator (chat-first escalation to audio/video within a single consultation session) uses the same WebSocket connection for both chat messages and WebRTC SDP/ICE signaling, reducing connection complexity while preserving the escalation model.

The dominant risks in this domain are not technical but operational: Stripe explicitly prohibits telemedicine and pharmacy transactions in its Acceptable Use Policy, meaning standard payment stack research leads directly to account termination. PHI encryption at the field level (not just TLS) must be built into the first database migration — retrofitting encryption onto live medical data is high-risk and expensive. Redis pub/sub must be in the WebSocket architecture from day one, not added when multi-worker deployment breaks chat in production. Every one of these mistakes is catastrophic to recover from and none of them is speculative — they are documented failure modes from production telemedicine deployments.

---

## Key Findings

### Recommended Stack

The stack is substantially constrained by the project mandate (FastAPI, Next.js, PostgreSQL) with well-researched additions in each category. On the backend: SQLAlchemy 2.0 with asyncpg (pinned to <0.29.0 for compatibility) for the async ORM layer; PyJWT with pwdlib[argon2] for auth (passlib and python-jose are both abandoned and break on Python 3.12); Celery 5.4 with Redis 7 for background tasks and scheduling; Stripe Connect for marketplace payment splits (with the critical caveat below). On the frontend: TanStack Query 5 with Axios for server state, Zustand 4 for thin client state, React Hook Form + Zod for complex multi-step forms, and shadcn/ui on Tailwind 4 for the multi-dashboard UI. Real-time is handled by FastAPI's native WebSocket support with Redis pub/sub for multi-worker broadcasting, and native browser RTCPeerConnection with a self-hosted coturn TURN server.

**Core technologies:**
- FastAPI 0.115.x: async REST + WebSocket server — mandated, actively maintained, native OpenAPI
- Next.js 16.x (App Router): frontend framework — mandated, SSR critical for doctor profile SEO
- PostgreSQL 16.x: primary database — mandated, ACID + row-level security for PHI isolation
- SQLAlchemy 2.0 + asyncpg 0.28.x: async ORM — pin asyncpg <0.29.0 (breaking change in 0.29)
- PyJWT 2.x + pwdlib[argon2]: auth — passlib and python-jose are both unmaintained, break on Python 3.12
- Redis 7.x: multi-worker WS bus + cache + rate limiting — required before deploying >1 uvicorn worker
- Celery 5.4.x: background tasks — appointment reminders, payouts, prescription notifications
- Healthcare-specialized payment processor (Corepay, PayKings, PayDiverse): **NOT Stripe** — Stripe AUP prohibits telemedicine and pharmacy
- coturn: self-hosted TURN server — required for ~15% of users behind symmetric NAT
- TanStack Query 5 + Axios: frontend server state — interceptors essential for JWT refresh
- shadcn/ui + Tailwind 4: UI — accessible, multi-dashboard, Tailwind v4 compatible

### Expected Features

The complete feature dependency chain runs: auth → doctor profiles → appointment booking → consultation (chat, then WebRTC escalation) → digital prescription → pharmacy order → pharmacist fulfillment. Every step depends on the one before it. The MVP must deliver this entire chain to prove the core value proposition; no meaningful validation is possible with a truncated flow.

**Must have (table stakes):**
- User auth for all 4 roles (patient, doctor, pharmacist, admin)
- Doctor profiles with specialty, qualifications, rating, and fee
- Doctor search and filtering by specialty and availability
- Appointment booking with payment (pre-authorized at booking time)
- Real-time chat consultation via WebSocket (HIPAA-compliant)
- Audio/video escalation via WebRTC (within the same consultation session)
- Digital prescription writing by doctor (structured, not free-text)
- OTC medicine store (browse, cart, checkout)
- Prescription-linked medicine ordering (the differentiated full-circle flow)
- Pharmacist dashboard (prescription queue, inventory, order fulfillment)
- Admin panel (user management, doctor verification, commission configuration)
- Patient consultation history and prescription records

**Should have (competitive differentiators):**
- Chat-first escalation model (chat → audio → video within one session) — reduces bandwidth friction
- Prescription auto-route to pharmacy queue (patient just confirms and pays)
- Real-time consultation status indicators (typing indicators, queue position)
- Verified post-consultation review system (no anonymous reviews)
- Doctor earnings transparency dashboard (exact commission split visible per consultation)
- Post-consultation follow-up messaging within the consultation window

**Defer (v2+):**
- Opt-in session recording — regulatory complexity and storage cost
- Native iOS/Android apps — responsive web PWA covers the MVP use case
- Insurance billing integration — payer API complexity is disproportionate to early value
- AI symptom checker / triage bot — regulatory liability before clinical processes mature
- Lab test booking — separate logistics domain

### Architecture Approach

The architecture is a layered monolith with domain service boundaries deployed behind Nginx as a reverse proxy. FastAPI handles all REST and WebSocket concerns organized by domain (auth, users, doctors, appointments, consultations, prescriptions, pharmacy, orders, payments). Domain services contain business logic; routers are kept thin. WebSocket chat and WebRTC signaling share the same WS connection per consultation room, with message type discriminating chat vs. signaling payloads. Redis pub/sub bridges messages across uvicorn workers. The Next.js frontend uses App Router route groups — `(patient)`, `(doctor)`, `(pharmacist)`, `(admin)` — with middleware enforcing RBAC at the navigation layer. PostgreSQL row-level security enforces resource ownership at the database layer as a secondary defense.

**Major components:**
1. REST API (FastAPI routers + services) — all CRUD, business logic, auth, payment processing
2. WebSocket Handler (FastAPI + Redis pub/sub) — chat rooms, WebRTC signaling relay, consultation state
3. Consultation Service — consultation lifecycle state machine (pending → chat → audio/video → closed)
4. Pharmacy Service — prescription-linked orders, OTC catalog, inventory, fulfillment states
5. Payment Service — patient charge, commission calculation, payout queue to doctor/pharmacist
6. Next.js App Router — 4 role-scoped route groups with per-role dashboards and consultation UI
7. PostgreSQL — primary store with row-level security for PHI isolation
8. Redis — WebSocket room state, session cache, cross-worker pub/sub, rate limiting

### Critical Pitfalls

1. **Stripe will terminate the account** — Stripe's AUP explicitly prohibits telemedicine and pharmacy transactions. Use a healthcare-specialized high-risk processor (Corepay, PayKings, PayDiverse) from day one. Design a payment abstraction layer so the processor can be swapped without rewriting business logic.

2. **WebRTC silently fails for ~15% of real users** — STUN alone cannot traverse symmetric NAT (corporate firewalls, many mobile carriers). Deploy a self-hosted coturn TURN server before the first external user test. Test explicitly with clients behind symmetric NAT — localhost testing will not surface this failure.

3. **WebSocket breaks under multi-worker deployment** — Each uvicorn worker has its own in-memory connection registry. Without Redis pub/sub, a patient on worker 1 and a doctor on worker 3 cannot exchange messages. Add Redis before deploying more than one worker — never as a retrofit.

4. **Prescription integrity has no enforcement layer** — A prescription treated as a simple database foreign key can be replayed, forged, or shared. Prescriptions must carry a server-signed HMAC token, an expiry date, and a single-use state machine (issued → redeemed). The pharmacy fulfillment endpoint must verify the signature, not just check that the prescription ID exists.

5. **PHI stored in plain text** — TLS in transit does not protect data at rest. Medical history, consultation notes, prescriptions, and diagnoses require AES-256 field-level encryption in the first database migration. Retrofitting encryption onto an existing schema with live data is a high-risk migration with breach notification obligations if discovered post-launch.

6. **Appointment double-booking under concurrent load** — Two simultaneous booking requests pass the availability check before either commits (TOCTOU race). Use `SELECT ... FOR UPDATE` on the availability slot or a unique constraint on `(doctor_id, start_time)` — never application-layer availability checks alone.

7. **RBAC checks role but not resource ownership** — Verifying that a user has the "patient" role does not prevent Patient A from reading Patient B's records by manipulating IDs. Define the full RBAC ownership matrix before writing the first endpoint; enforce it via PostgreSQL RLS and application-layer ownership checks.

8. **Commission payout chaos without a ledger model** — Commission splits calculated as mutable fields become unreconcilable when refunds, partial fulfillments, or payout failures occur. Implement an immutable append-only ledger from the start; snapshot the commission rate at transaction time.

---

## Implications for Roadmap

The architecture research provides an explicit build-order dependency chain. The pitfalls research maps directly to which phases must address which risks. These should be treated as hard constraints, not suggestions.

### Phase 1: Foundation and Infrastructure

**Rationale:** Auth, data model, and infrastructure decisions must be made before any feature is built. PHI encryption, RBAC matrix, and payment processor selection cannot be retrofitted cheaply — they are the costliest mistakes to fix later.
**Delivers:** Running development environment, user authentication for all 4 roles, base data model with PHI encryption, RBAC matrix defined, payment processor confirmed
**Addresses:** User auth and role management (P1 feature), doctor profile schema, all table structures
**Avoids:** PHI plain text storage (Pitfall 5), RBAC cross-role data leak (Pitfall 7), wrong payment processor (Pitfall 1), sequential IDs on patient-facing resources
**Stack used:** FastAPI, PostgreSQL + SQLAlchemy + Alembic, PyJWT + pwdlib[argon2], Redis (even if not load-bearing yet — architecture must include it), Docker Compose dev environment
**Research flag:** Payment processor selection requires business/legal validation before code is written — verify chosen processor's AUP explicitly covers both telemedicine consultations AND pharmacy sales

### Phase 2: Doctor Discovery and Appointment Booking

**Rationale:** Appointment booking is the first transactional event and the prerequisite for everything downstream (consultation, prescription, pharmacy order). Doctor profiles and search must exist before booking is possible.
**Delivers:** Doctor profiles with specialty and availability management, searchable doctor catalog, appointment booking with payment pre-authorization, doctor verification admin workflow
**Addresses:** Doctor profiles, doctor search and filtering, appointment booking with payment, doctor availability management, admin doctor verification workflow (all P1)
**Avoids:** Appointment double-booking (Pitfall 6 — implement SELECT FOR UPDATE from day one), N+1 queries on doctor listing (index and join strategy in this phase)
**Stack used:** FastAPI routers + services + repository pattern, TanStack Query + Axios on frontend, React Hook Form + Zod for booking forms, Stripe Connect alternative (healthcare processor)
**Research flag:** Standard patterns — well-documented booking and availability logic; no additional research needed

### Phase 3: Real-Time Consultation (Chat + WebRTC)

**Rationale:** Consultation is the core value delivery of the platform. Chat must be built before WebRTC because WebRTC signaling reuses the same WebSocket connection. Redis pub/sub must be operational before this phase is complete.
**Delivers:** Real-time chat consultation room, WebRTC audio/video escalation within the same session, consultation lifecycle state machine (pending → active → chat → audio/video → closed), consultation history persistence
**Addresses:** Chat consultation (P1), audio/video escalation (P1), patient consultation history (P1), real-time consultation status indicators (P2)
**Avoids:** WebSocket multi-worker failure (Pitfall 3 — Redis pub/sub in architecture from day one), WebRTC symmetric NAT failure (Pitfall 2 — coturn operational before first WS endpoint is deployed), WebSocket business logic inline in route handlers (anti-pattern), polling for consultation status (anti-pattern)
**Stack used:** FastAPI WebSocket with ConnectionManager + Redis pub/sub, native RTCPeerConnection (no third-party SDK), coturn TURN server, Zustand for call state on frontend
**Research flag:** TURN server configuration and symmetric NAT testing require explicit verification — test with clients behind different networks before marking phase complete

### Phase 4: Prescriptions and Pharmacy

**Rationale:** Prescriptions are only issued after a completed consultation. The pharmacy ordering flow depends on prescriptions being structured (not free-text) and signed. OTC store can be built in parallel once the product catalog exists.
**Delivers:** Structured digital prescription writing by doctor, prescription PDF generation with download, prescription-linked pharmacy ordering, OTC medicine store (browse, cart, checkout), pharmacist dashboard (queue, inventory, fulfillment), prescription-to-pharmacy auto-routing
**Addresses:** Digital prescription writing (P1), prescription-linked medicine ordering (P1), OTC store (P1), pharmacist dashboard (P1), prescription auto-route to pharmacy (P2)
**Avoids:** Prescription as free-text anti-pattern, prescription integrity with no enforcement layer (Pitfall 4 — HMAC-signed tokens, single-use state machine, expiry dates from day one)
**Stack used:** Prescription service + pharmacy service as internal Python domain services, boto3 + MinIO/S3 for prescription PDF storage, structured prescription_items table with medicine_id foreign keys
**Research flag:** Prescription signing and single-use enforcement are security-critical — verify the signed token implementation is tested adversarially (replay attack, ID manipulation) before the phase is marked complete

### Phase 5: Payments, Commissions, and Payouts

**Rationale:** Payment is required from Phase 2 (appointment booking) but the full commission ledger and payout system can be completed here once all revenue streams are in place (consultation fees + medicine order margins).
**Delivers:** Full marketplace payment flow (patient charge → platform commission → doctor/pharmacist payout), immutable financial ledger, payout dashboard for doctors and pharmacists, admin commission configuration, refund and dispute handling
**Addresses:** Payment processing (P1), doctor earnings dashboard (P2), admin commission configuration (P1), dispute and support management (P1)
**Avoids:** Commission payout chaos (Pitfall 8 — immutable ledger, snapshot commission rate at transaction time, explicit payout failure handling), payout failure with no retry mechanism
**Stack used:** Healthcare-specialized high-risk payment processor SDK, Celery for async payout scheduling, Redis for distributed Celery Beat scheduling, ledger table in PostgreSQL
**Research flag:** Integration specifics for the chosen healthcare payment processor (Corepay, PayKings, or PayDiverse) will need API documentation review — their SDKs are less documented than Stripe Connect

### Phase 6: Admin Panel, Notifications, and Platform Hardening

**Rationale:** Admin tooling and notification infrastructure are cross-cutting concerns that add operational control and trust to a working platform. These can be built once all core entities exist.
**Delivers:** Admin panel (user management, doctor verification workflow, platform analytics, dispute handling), email and in-app notifications (appointment reminders, prescription ready, order status), rate limiting, audit logging for PHI access
**Addresses:** Admin panel (P1), notifications (P2), platform analytics (P1), verified post-consultation review system (P2), audit log (security requirement)
**Avoids:** No audit trail for PHI access (security mistake), open TURN server (no authentication), API endpoint enumeration via sequential IDs
**Stack used:** SlowAPI for rate limiting, Celery Beat for scheduled reminders, Resend for transactional email, PostgreSQL append-only audit log table
**Research flag:** Standard patterns — notifications and admin panels are well-documented; no additional research needed

### Phase Ordering Rationale

- **Infrastructure-first:** PHI encryption, RBAC matrix, and payment processor selection are imposed at Phase 1 because the cost of retrofitting them is catastrophically high. These are not sequencing preferences — they are risk mitigation constraints from the pitfalls research.
- **Dependency chain honored:** The architecture research provides an explicit build-order: auth → doctor profiles → appointment → consultation (chat) → consultation (WebRTC) → prescriptions → pharmacy → payments. This ordering is not arbitrary; each step is a technical prerequisite for the next.
- **WebRTC never before WebSocket:** WebRTC signaling reuses the chat WebSocket infrastructure. Building WebRTC before chat is complete creates an integration dead end.
- **Redis from day one:** Pitfall 3 establishes that adding Redis pub/sub as a retrofit to a deployed multi-worker system requires a coordinated redeploy and drops all active sessions. Redis belongs in Phase 1 infrastructure even if it is not load-bearing until Phase 3.
- **Prescription before pharmacy order:** Structured prescriptions (with signed tokens and state machines) must be in place before the pharmacy ordering flow is built, or the security model cannot be enforced at fulfillment.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (payment processor selection):** Corepay, PayKings, and PayDiverse are healthcare-specialized processors with less developer documentation than Stripe. API capabilities, SDK quality, and sandbox environment availability need verification before integration design begins.
- **Phase 3 (TURN server configuration):** coturn production configuration (authentication, DDoS rate limiting, per-session bandwidth caps) is well-documented but operationally specific. The symmetric NAT test plan needs explicit definition.
- **Phase 4 (prescription security model):** The HMAC signing scheme, single-use nonce design, and controlled substance flagging logic should be researched against regulatory requirements for the target jurisdiction before implementation.
- **Phase 5 (healthcare payment processor SDK):** Unlike Stripe, the chosen high-risk processor's SDK will need direct API documentation review; community examples will be sparse.

Phases with standard patterns (skip additional research):
- **Phase 2 (appointment booking):** Doctor availability management and booking with payment are extremely well-documented patterns; SQLAlchemy + PostgreSQL locking strategies are documented in official sources.
- **Phase 6 (admin panel + notifications):** Admin CRUD interfaces and transactional email are standard patterns; Resend has official FastAPI integration guides.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technologies verified against official docs, PyPI/GitHub releases, and FastAPI official migration PRs (PyJWT, pwdlib). asyncpg version pin is a documented SQLAlchemy compatibility note. |
| Features | HIGH | Competitor analysis (Teladoc, HealthTap, ZocDoc), multiple industry development guides, and feature dependency logic all converge on the same MVP scope. |
| Architecture | MEDIUM-HIGH | FastAPI + WebSocket + Redis pub/sub pattern is extensively documented. WebRTC + FastAPI signaling combination is verified via official WebRTC docs and community implementations. Multi-worker scaling behavior is confirmed behavior, not inference. |
| Pitfalls | HIGH | Stripe AUP restriction is a documented policy. WebRTC NAT failure rate is cited in production TURN server literature. WebSocket multi-worker failure is a known FastAPI limitation. PHI encryption requirements are regulatory. All pitfalls come from multiple independent sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **Payment processor selection is unresolved:** The STACK.md research recommends Stripe Connect for marketplace payment splits and explicitly notes it is the best-in-class solution — but PITFALLS.md confirms Stripe's AUP prohibits telemedicine and pharmacy. This is a direct conflict that requires explicit resolution in Phase 1 before any payment code is written. Research a healthcare-specialized high-risk processor (Corepay, PayKings, PayDiverse, Seamless Chex) and verify it supports both consultation fee splits AND pharmacy sales commissions. Design the payment abstraction layer to be processor-agnostic.

- **Jurisdiction-specific regulatory requirements:** The research covers general HIPAA-aware practices but does not specify which jurisdiction's telemedicine regulations apply (different countries have different e-prescription and teleconsultation licensing requirements). This needs to be confirmed at the requirements stage before the prescription and pharmacy phases are designed.

- **coturn bandwidth cost modeling:** The TURN server handles relay traffic for ~15-20% of WebRTC sessions. Bandwidth costs at scale depend on consultation volume and average call duration. This should be modeled before the WebRTC phase is scoped — coturn has no per-minute billing but does have infrastructure costs.

- **Doctor onboarding KYC flow:** The research confirms Stripe Connect Express handles KYC for doctor onboarding. With a non-Stripe processor, the KYC and identity verification process for doctor/pharmacist onboarding needs to be sourced from the chosen processor or a separate identity verification service (Persona, Onfido).

---

## Sources

### Primary (HIGH confidence)
- FastAPI official release notes — https://fastapi.tiangolo.com/release-notes/
- FastAPI JWT migration to PyJWT — https://github.com/fastapi/fastapi/pull/11589
- SQLAlchemy 2.0 asyncpg compatibility — https://www.sqlalchemy.org/blog/2025/02/06/sqlalchemy-2.0.38-released/
- Stripe Connect marketplace docs — https://stripe.com/connect/marketplaces
- Seamless Chex: Stripe telemedicine restrictions — https://www.seamlesschex.com/blog/payment-methods-you-can-accept-with-a-telemedicine-merchant-account
- TURN server production setup (2025) — https://webrtc.ventures/2025/01/how-to-set-up-self-hosted-stun-turn-servers-for-webrtc-applications/
- WebSockets at scale with FastAPI — https://medium.com/@bhagyarana80/websockets-at-scale-with-fastapi-and-uvicorn-workers-building-real-time-systems-that-dont-break-ac2dada6cae9
- PHI encryption best practices — https://censinet.com/perspectives/best-practices-for-cloud-phi-encryption-at-rest
- PostgreSQL HIPAA compliance — https://gartsolutions.com/postgresql-hipaa-compliance/

### Secondary (MEDIUM confidence)
- FastAPI best practices — https://github.com/zhanymkanov/fastapi-best-practices
- WebRTC + FastAPI signaling — https://dev.to/wassafshahzad/building-real-time-communication-harnessing-webrtc-with-fastapi-part-1-ael
- Scaling WebSockets with Redis pub/sub — https://medium.com/@nandagopal05/scaling-websockets-with-pub-sub-using-python-redis-fastapi-b16392ffe291
- Telemedicine app features (2025) — https://empeek.com/insights/telemedicine-features/
- Telemedicine app development guide — https://neklo.com/blog/telemedicine-app-development
- CometChat: telemedicine system architecture — https://www.cometchat.com/blog/system-design-architecture-of-telemedicine-system
- E-prescription security requirements — https://www.zengrc.com/blog/security-requirements-for-digital-pharmacy-platforms/
- Healthcare RBAC challenges — https://censinet.com/perspectives/common-challenges-role-based-access-control-implementation

### Tertiary (LOW confidence — verify during implementation)
- Healthcare high-risk payment processors — https://corepay.net/industries/best-telemedicine-merchant-account/ (needs direct AUP and SDK verification)
- Telemedicine development challenges 2026 — https://averybit.com/telemedicine-app-development-challenges-2026/

---

*Research completed: 2026-03-19*
*Ready for roadmap: yes*
