# Pitfalls Research

**Domain:** Healthcare / Telemedicine Marketplace
**Researched:** 2026-03-19
**Confidence:** HIGH (critical pitfalls verified across multiple authoritative sources)

---

## Critical Pitfalls

### Pitfall 1: Stripe (and Square/PayPal) Will Terminate Your Account

**What goes wrong:**
Teams build the entire payment flow around Stripe Connect — collecting consultation fees, splitting commissions, paying out doctors — then discover Stripe's Acceptable Use Policy explicitly prohibits telemedicine services and online pharmacy transactions. The account gets terminated mid-operation, leaving no way to process payments until a replacement is integrated.

**Why it happens:**
Stripe is the "default" payment processor developers reach for due to excellent docs and DX. The restriction is buried in the AUP rather than prominently signaled, and it isn't obvious until Stripe's risk team reviews the business type. Stripe also restricts pharmacy (especially prescription medication) sales. Square and PayPal have the same restrictions.

**How to avoid:**
Use a healthcare-specialized high-risk payment processor from the start. Options that explicitly support telemedicine: Corepay, PayKings, PayDiverse, Seamless Chex. Design the payment abstraction layer so the processor can be swapped. Never build payment logic tightly coupled to one provider's SDK. Verify the chosen processor supports both consultation fees AND pharmacy sales before implementation.

**Warning signs:**
- You chose Stripe without explicitly verifying their AUP covers telemedicine + pharmacy
- Payment integration is being designed before processor selection is confirmed
- No mention of "high-risk merchant account" in planning documents

**Phase to address:**
Phase 1 (Foundation / Infrastructure) — processor selection must happen before any payment code is written. The payment abstraction interface should be defined in the foundation phase so it can be swapped.

---

### Pitfall 2: WebRTC Works in Dev, Silently Fails for ~15% of Real Users

**What goes wrong:**
Peer-to-peer WebRTC connections work perfectly in local/development environments where both peers are on the same network or simple NATs. In production, users behind corporate firewalls, symmetric NATs, or strict mobile carrier networks (estimated 8-15% of real-world traffic) cannot establish direct peer connections. These users get no video/audio with no meaningful error message.

**Why it happens:**
STUN alone handles only direct NAT traversal. Symmetric NAT (common in corporate networks, many mobile carriers) requires TURN relay. Without TURN, the ICE negotiation silently exhausts candidates and fails. Developers test on home networks which rarely use symmetric NAT.

**How to avoid:**
Deploy a TURN server (coturn) from day one of WebRTC development, not after launch. Configure ICE with both STUN and TURN candidates. Test explicitly with clients behind symmetric NAT (use a VPN or mobile hotspot to simulate). Use the TURN server as a fallback, not an afterthought. For a self-hosted coturn instance: configure DDoS rate limiting, enable authentication (no open relay), and plan bandwidth capacity (~1 Mbps per relayed video call).

**Warning signs:**
- WebRTC is only tested on localhost or same-network devices
- TURN server setup is deferred to "later" or "after MVP"
- No test plan covering corporate firewall environments
- ICE configuration only includes Google's public STUN server

**Phase to address:**
Phase implementing WebRTC (real-time consultation) — TURN server must be operational before any WebRTC feature is marked complete, not as a follow-up task.

---

### Pitfall 3: WebSocket Connections Break Under Multi-Worker Deployment

**What goes wrong:**
FastAPI WebSocket chat works perfectly with a single Uvicorn worker. When deployed with multiple workers (the standard for any production load), a patient connected to worker 1 and a doctor connected to worker 3 cannot exchange messages. Chat appears to work in testing (single process) but fails in production for cross-worker connections.

**Why it happens:**
Each worker process has its own in-memory connection registry. FastAPI's built-in WebSocket manager has no cross-process awareness. Developers test with `uvicorn app:app` (single worker) and never exercise the multi-worker path. The failure is silent — messages are dropped, not errored.

**How to avoid:**
Add Redis Pub/Sub as the cross-worker message bus before any WebSocket feature is considered production-ready. Connection managers must publish to Redis channels and subscribe for delivery to local connections. Also handle: browsers cannot set Authorization headers on WebSocket connections — use a token query parameter or a protocol-level handshake for authentication (not the HTTP Bearer pattern).

**Warning signs:**
- WebSocket connection manager stores state in a Python dict or list
- Deployment config specifies `--workers > 1` but no Redis is configured
- WebSocket authentication uses `Authorization: Bearer` headers directly
- No test covering two clients on different simulated processes

**Phase to address:**
Phase 1 or 2 (real-time chat foundation) — Redis must be in the architecture before the first WebSocket endpoint is deployed, not added when scaling issues appear.

---

### Pitfall 4: Prescription Integrity Has No Enforcement Layer

**What goes wrong:**
The e-pharmacy module allows patients to submit or reference prescriptions for controlled/prescription-only medicines, but there is no server-side validation that a prescription actually originated from a platform doctor, hasn't been used, or hasn't been tampered with. Patients can replay old prescriptions, share them with others, or (in a badly implemented system) forge them by crafting API requests.

**Why it happens:**
Prescription handling is treated as a database join (appointment → prescription → order) without considering that the pharmacy fulfillment path is a security boundary. Developers focus on the happy path (doctor issues, patient orders) without modeling adversarial use.

**How to avoid:**
Every prescription must carry a server-generated, signed token tied to: the doctor's verified identity, a specific patient, the exact medication/quantity, and a single-use nonce. The pharmacy fulfillment endpoint must verify this signature before allowing an order. Prescriptions must have expiry dates enforced at the database level. Implement a state machine: `issued → redeemed` with no re-entry. Controlled substances should have an explicit flag requiring additional verification.

**Warning signs:**
- Prescription table has no signed token or verification hash column
- Pharmacy order endpoint only checks `prescription_id` exists (no signature verification)
- No expiry field on prescriptions
- Prescription reuse is not tested as an adversarial case

**Phase to address:**
Pharmacy phase — prescription issuance and fulfillment must be designed as a secure handoff protocol, not a simple foreign key relationship.

---

### Pitfall 5: Patient Health Data Stored Without Field-Level Encryption

**What goes wrong:**
Medical history, consultation notes, diagnoses, and prescription records are stored as plain text in PostgreSQL. A database breach, a misconfigured query that leaks data to the wrong role, or a compromised admin account exposes Protected Health Information (PHI) for all patients at once.

**Why it happens:**
TLS in transit is conflated with encryption at rest. Developers assume "the database is behind a firewall" is sufficient. Encryption is planned as a "compliance step" for after launch.

**How to avoid:**
Apply AES-256 field-level encryption to PHI columns (medical history, consultation notes, prescription details, diagnosis codes) at the application layer, not just OS-level disk encryption. Manage encryption keys separately from the database — never store keys in the same environment. Use PostgreSQL row-level security (RLS) so that even a valid DB connection cannot read another patient's rows. Define which columns contain PHI in the data model design phase and encrypt them from the first migration.

**Warning signs:**
- Data model design has no PHI classification annotations
- Encryption is listed as a "Phase N" task separate from the feature implementing the data
- Key management is not in the architecture plan
- No row-level security policies in the PostgreSQL schema

**Phase to address:**
Phase 1 (data model / foundation) — PHI columns must be identified and encrypted in the first migration. Retrofitting encryption onto an existing schema with live data is a high-risk migration.

---

### Pitfall 6: Appointment Double-Booking Under Concurrent Load

**What goes wrong:**
Two patients simultaneously select the same available time slot for the same doctor. Both see "available," both proceed, both receive confirmation. The doctor now has two appointments at the same time with no automated conflict detection.

**Why it happens:**
The booking flow uses a read-then-write pattern: check if slot is available, then insert the appointment. Without row-level locking, two concurrent requests pass the availability check before either commits. This is classic TOCTOU (time-of-check to time-of-use) and is invisible in low-traffic development.

**How to avoid:**
Use PostgreSQL `SELECT ... FOR UPDATE` on the availability slot row to acquire an exclusive lock before writing. Alternatively, use a unique constraint on `(doctor_id, start_time)` and catch the constraint violation as a booking failure. Implement optimistic locking with a version column if advisory locks are preferred. Never rely on application-layer availability checks alone.

**Warning signs:**
- Booking endpoint does a SELECT then INSERT without a transaction + lock
- No unique constraint on `(doctor_id, appointment_time)`
- Concurrent booking is not in the test suite
- Availability check and appointment creation are in separate HTTP requests

**Phase to address:**
Appointment booking phase — locking strategy must be part of the booking endpoint design, not added after a double-booking incident is reported.

---

### Pitfall 7: RBAC Misconfiguration Leaks Cross-Role Data

**What goes wrong:**
A pharmacist can query patient medical history. A patient can see another patient's prescriptions via a predictable ID in the URL. A doctor can see consultation records from another doctor's patients. These leaks occur not because authentication is broken but because authorization checks are missing or coarse.

**Why it happens:**
Teams implement authentication thoroughly (JWT, roles in token) but apply authorization only at the route level ("this endpoint requires doctor role") without checking ownership at the resource level ("this doctor can only access their own consultations"). Healthcare platforms have 4 roles (patient, doctor, pharmacist, admin) with complex cross-cutting access rules that are easy to underspecify.

**How to avoid:**
Define the full RBAC matrix before writing the first endpoint: for every resource type and every role, explicitly list READ/WRITE/LIST permissions with ownership conditions. Use PostgreSQL Row-Level Security (RLS) as the enforcement layer — not just application-layer guards — so that even direct DB queries respect access rules. Write authorization unit tests that attempt cross-user and cross-role access and expect 403/404 responses.

**Warning signs:**
- Authorization checks only verify role, not resource ownership
- No written RBAC matrix in design documents
- API endpoints use sequential integer IDs (predictable enumeration)
- No test cases for "patient tries to read another patient's records"

**Phase to address:**
Phase 1 (auth/identity foundation) — RBAC matrix must be defined before any protected endpoint is implemented. Adding ownership checks retroactively across dozens of endpoints is error-prone.

---

### Pitfall 8: Commission Payout Splits Become Accounting Chaos

**What goes wrong:**
The platform collects a combined payment from the patient (consultation fee + pharmacy margin), then needs to pay out the doctor and pharmacist their portions. Without a formal ledger model, refunds, partial refunds, disputes, and failed payouts result in an unreconcilable financial state. Commission rates that change over time corrupt historical records if not versioned.

**Why it happens:**
Marketplace payment splits are modeled as a one-time calculation rather than as a double-entry accounting ledger. Developers think: "multiply by commission rate, transfer the rest." They don't model what happens when a consultation is cancelled after partial completion, when a pharmacy order is partially fulfilled, or when a doctor account has a failed payout.

**How to avoid:**
Implement a simple ledger model: every financial event (charge, commission deduction, payout, refund) is an immutable ledger entry. Never update a payment record — only append corrections. Store the commission rate that was in effect at transaction time, not a reference to current settings. Model payouts as "pending → processing → completed/failed" with explicit retry and failure handling.

**Warning signs:**
- Commission is calculated as a field on the appointment/order record (not a separate ledger)
- Refund logic is not designed alongside the initial payment design
- Commission rate is a global config value with no versioned history
- Payout failure handling is not in the design

**Phase to address:**
Payment integration phase — ledger model must be defined before any financial transaction is processed. Retrofitting a ledger onto mutable payment records requires a data migration and audit.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| In-memory WebSocket connection manager (no Redis) | Zero setup, simple code | Breaks silently with multiple workers; complete rewrite required | Never — add Redis in dev from the start |
| Plain text storage for all DB fields | Faster development | PHI breach exposes all patient data; compliance violation | Never for PHI fields |
| Application-only authorization (no RLS) | Faster to implement | Data leak risk remains even if app has bugs | Never in healthcare context |
| Sequential integer IDs on medical records | Simple to implement | Enables enumeration attacks (patient can guess other patient IDs) | Never — use UUIDs for all patient-facing resource IDs |
| STUN-only WebRTC (no TURN) | No server costs | ~15% of users cannot connect; no error message | Never — add TURN before first external user test |
| Single commission rate config (no versioning) | Simple settings page | Historical transaction amounts become inconsistent after rate change | Never — snapshot rate at transaction time |
| Prescription as a simple FK (no signed token) | Faster to build | Prescription reuse, forgery, unauthorized fulfillment | Never — sign prescriptions at issuance |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Payment processor | Using Stripe/PayPal without verifying AUP covers telemedicine + pharmacy | Verify AUP coverage before any integration work; use healthcare-specialized high-risk processor |
| WebRTC / TURN | Using Google's public STUN only, assuming P2P always works | Deploy authenticated coturn with DDoS rate limiting; test against symmetric NAT |
| WebSocket auth | Reusing HTTP `Authorization: Bearer` header pattern | Use token in query param or sub-protocol header at connection upgrade time |
| Redis Pub/Sub | Adding Redis only when scaling becomes a problem | Include Redis in architecture from day one of WebSocket development |
| PostgreSQL multi-worker | Assuming in-process connection state is shared | All shared state (WebSocket registry, session state) must live in Redis/DB, not process memory |
| Prescription → Pharmacy | Treating as a simple database join | Treat as a signed token handoff with state machine enforcement |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching all doctor availability slots without pagination | Doctor search page hangs; slow query on appointment table | Paginate availability queries; index `(doctor_id, start_time)` | ~500 doctors with hourly slots for 30 days = 180k rows per query |
| Sending WebSocket broadcast to all connections on every message | Chat works for 10 users; CPU spikes for 100 | Route messages only to room/consultation participants; use Redis channel per consultation room | ~50 concurrent consultations |
| TURN server with no bandwidth cap per session | A single stuck video call consumes all relay bandwidth | Configure per-session TURN bandwidth limits in coturn; monitor relay traffic | Any production load without limits |
| Loading full patient medical history on every consultation view | Consultation page slow to load | Paginate history; load recent records by default, older records on demand | Patients with years of history (~50+ consultations) |
| N+1 queries on doctor listing (fetching ratings/specialties per doctor) | Doctor search is slow; high DB load on search page | Use JOIN or subquery to fetch aggregates alongside doctor records | Doctor listing with >50 results |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing PHI in plain text in PostgreSQL | Complete exposure of all patient data in a breach | AES-256 field-level encryption on PHI columns; keys stored in a separate secret manager |
| Authorization checks at route level only (no resource ownership check) | Patient A can read Patient B's records by guessing their UUID | PostgreSQL RLS + application-layer ownership check on every data access |
| Open TURN server (no authentication) | Server used as a free relay / DDoS amplification source | Enable coturn's HMAC-SHA1 credential mechanism; rotate credentials per session |
| Predictable sequential IDs on prescription and appointment records | Enumeration attack allows scraping all records | Use UUID v4 for all patient-facing resource identifiers |
| Prescription token not signed server-side | Prescription forgery, replay attacks, unauthorized pharmacy fulfillment | HMAC-sign prescription tokens at issuance; verify signature at pharmacy fulfillment |
| Consultation chat stored without encryption | Support access or DB admin can read private medical conversations | Encrypt chat message content at the application layer; store encrypted blobs, decrypt in-session |
| No audit log for PHI access | Cannot detect or investigate unauthorized data access | Append-only audit log table for every read/write of PHI; include actor, timestamp, IP |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Forcing video call without testing connection first | Doctor and patient join a consultation where video never works; session wasted | Implement a pre-consultation connection test ("check your camera and mic") before escalating to video |
| No fallback when WebRTC fails (just a broken UI) | Patient sees a blank video area with no explanation or alternative | Detect ICE failure explicitly; offer audio-only fallback and chat continuation |
| Chat history not persisted across reconnections | Patients reconnecting (mobile network switch) lose consultation context | Persist all chat messages to DB; load history on WebSocket reconnection |
| Prescription PDF with no download/print option | Patient cannot take prescription to an offline pharmacy | Generate downloadable PDF prescription with QR code or unique verification code |
| Doctor availability shown in platform timezone (not patient timezone) | Patient books 3pm thinking it's their local time, arrives at wrong time | Always display times in the viewer's local timezone; store in UTC, display with explicit timezone label |
| OTC medicine catalog with no search/filter | Patients cannot find medicines in a large inventory | Implement search by name, category, and symptom from day one of the pharmacy module |
| Consultation escalation requires re-booking | Chat-first model breaks if escalating to video requires leaving the chat UI and booking a new session | Design escalation as an in-consultation action, not a booking flow restart |

---

## "Looks Done But Isn't" Checklist

- [ ] **WebRTC Video Call:** Works on local network but not tested through TURN server — verify by testing with clients on different networks through coturn
- [ ] **Prescription Issuance:** Creates a DB record but doesn't sign the token — verify signature is present and verified at pharmacy fulfillment
- [ ] **Appointment Booking:** Succeeds in sequential tests but not concurrency-tested — verify with simultaneous requests from two clients for the same slot
- [ ] **Multi-Worker Chat:** Works with single Uvicorn worker but breaks under load — verify by running two worker processes and sending a cross-worker message
- [ ] **Payment Commission:** Calculates correctly on the happy path but not tested with refunds or partial orders — verify refund flow returns correct amounts to all parties
- [ ] **RBAC:** Roles are checked but ownership is not — verify that authenticated Patient A cannot access Patient B's consultation records via ID manipulation
- [ ] **PHI Encryption:** TLS is enabled but DB fields are plain text — verify that direct DB SELECT on medical_history returns encrypted bytes, not readable text
- [ ] **Doctor Payout:** Commission split is calculated but payout failure handling is untested — verify that a failed payout is queued for retry and surfaced to admin
- [ ] **Consultation Chat History:** Shows current session but not restored after disconnect — verify that reconnecting patient sees full prior message history
- [ ] **Prescription Reuse:** Single-use not enforced — verify that presenting the same prescription token twice at pharmacy is rejected on the second attempt

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong payment processor (Stripe termination) | HIGH | Payment abstraction layer allows swap; all financial history must be migrated; expect 1-2 weeks downtime on payments |
| No TURN server (users cannot connect) | MEDIUM | Deploy coturn, update ICE config, redeploy; no data migration; 1-2 day fix but trust damage is immediate |
| WebSocket multi-worker failure in production | HIGH | Add Redis, refactor connection manager, redeploy; if state was in-process, all active sessions disconnect; requires coordinated deploy |
| Plain text PHI discovered post-launch | VERY HIGH | Encrypt-in-place migration (risky), breach notification obligations, potential regulatory penalties; months of remediation |
| Prescription token forgery discovered | HIGH | Invalidate all existing prescription tokens, require re-issuance, notify affected pharmacies, implement signing |
| Double-booking discovered at scale | MEDIUM | Add DB constraint migration (low risk), implement compensation flow for affected appointments; 1-2 day fix |
| Commission ledger inconsistency | HIGH | Audit all transactions against payment processor records, write reconciliation script, rebuild ledger from payment processor webhooks |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Wrong payment processor | Phase 1: Foundation & Infrastructure | Processor AUP explicitly covers telemedicine + pharmacy; test account created before code is written |
| WebRTC TURN server gaps | Phase: Real-time Consultation | TURN test passes with client behind simulated symmetric NAT |
| WebSocket multi-worker failure | Phase 1 or Phase: Chat | Redis Pub/Sub in architecture diagram; integration test with two workers |
| Prescription integrity missing | Phase: Pharmacy / Prescription | Pharmacy fulfillment endpoint test rejects unsigned or replayed token |
| PHI in plain text | Phase 1: Data Model / Foundation | DB migration shows encrypted column types; SELECT on PHI column returns ciphertext |
| Appointment double-booking | Phase: Appointment Booking | Concurrent booking test proves only one confirmation issued |
| RBAC cross-role data leak | Phase 1: Auth / Identity | Cross-user access test returns 403/404, not the other user's data |
| Commission payout chaos | Phase: Payments / Commission | Ledger balance reconciles against payment processor records after test transactions |

---

## Sources

- Telemedicine development challenges: https://averybit.com/telemedicine-app-development-challenges-2026/
- Stripe telemedicine restrictions: https://www.seamlesschex.com/blog/payment-methods-you-can-accept-with-a-telemedicine-merchant-account
- Healthcare high-risk payment processors: https://corepay.net/industries/best-telemedicine-merchant-account/
- WebRTC healthcare implementation: https://www.remoteicu.com/glossary/webrtc-healthcare-implementation/
- WebRTC STUN vs TURN: https://getstream.io/resources/projects/webrtc/advanced/stun-turn/
- TURN server production setup: https://webrtc.ventures/2025/01/how-to-set-up-self-hosted-stun-turn-servers-for-webrtc-applications/
- TURN server costs and failure modes: https://dev.to/alakkadshaw/turn-server-costs-a-complete-guide-1c4b
- FastAPI WebSocket multi-worker: https://medium.com/@bhagyarana80/websockets-at-scale-with-fastapi-and-uvicorn-workers-building-real-time-systems-that-dont-break-ac2dada6cae9
- WebSocket scaling with Redis: https://blog.greeden.me/en/2025/10/28/weaponizing-real-time-websocket-sse-notifications-with-fastapi-connection-management-rooms-reconnection-scale-out-and-observability/
- E-prescription fraud: https://www.drugtopics.com/view/how-individuals-commit-e-prescription-fraud
- Prescription security requirements: https://www.zengrc.com/blog/security-requirements-for-digital-pharmacy-platforms/
- Healthcare RBAC mistakes: https://censinet.com/perspectives/common-challenges-role-based-access-control-implementation
- PHI encryption best practices: https://censinet.com/perspectives/best-practices-for-cloud-phi-encryption-at-rest
- PostgreSQL HIPAA compliance: https://gartsolutions.com/postgresql-hipaa-compliance/
- Telemedicine security challenges: https://binariks.com/blog/7-security-problems-challenges-of-telemedicine-software-adoption/

---
*Pitfalls research for: Healthcare Telemedicine Marketplace (FastAPI + Next.js + PostgreSQL + WebRTC/WebSocket)*
*Researched: 2026-03-19*
