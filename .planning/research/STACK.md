# Stack Research

**Domain:** Healthcare telemedicine marketplace (multi-sided: patients, doctors, pharmacists, admins)
**Researched:** 2026-03-19
**Confidence:** HIGH (core stack verified via official docs and multiple 2025 sources; version numbers spot-checked against PyPI/GitHub releases)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| FastAPI | 0.115.x | Python async REST API + WebSocket server | Non-negotiable per project constraints. Actively maintained (0.115.14 released July 2025). Native async support, automatic OpenAPI docs, Pydantic v2 integration. Industry standard for Python healthcare APIs. |
| Next.js | 16.x (App Router) | React frontend framework | Non-negotiable per constraints. Next.js 16.1 stable as of December 2025. App Router + React 19 Server Components is the current production standard. SSR critical for SEO on doctor profile/pharmacy pages. |
| PostgreSQL | 16.x | Primary relational database | Non-negotiable per constraints. ACID compliance required for financial transactions and medical records. Row-level security for PHI isolation. Native JSON columns for flexible medical data. |
| Python | 3.12+ | Backend runtime | FastAPI 0.115.x supports Python 3.12. Required to avoid passlib/crypt deprecation warnings introduced in 3.11. |
| TypeScript | 5.x | Frontend type safety | Required for large multi-role codebase. Catches interface mismatches between frontend and FastAPI's OpenAPI schema early. |

---

### Database Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| SQLAlchemy | 2.0.41+ | Python ORM | The async engine (`create_async_engine`) with `AsyncSession` is first-class in 2.0. Aligns with FastAPI's async model. Version 2.0.41 released May 2025. |
| asyncpg | 0.28.x | Async PostgreSQL driver | Required by SQLAlchemy's async engine. **Pin to `<0.29.0`** — asyncpg 0.29.0+ has known compatibility issues with SQLAlchemy 2.0.x's `create_async_engine`. Fastest async PostgreSQL driver available. |
| Alembic | 1.13.x | Database migrations | The standard migration tool for SQLAlchemy. **Never use `Base.metadata.create_all()` in production** — always use `alembic upgrade head`. Alembic uses a sync engine internally even in async apps; this is expected behavior. |

---

### Real-Time Communication

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| FastAPI WebSocket (built-in) | (with FastAPI 0.115.x) | WebSocket server for chat signaling | FastAPI's native WebSocket support via Starlette is production-ready. No extra library needed. Handles the chat-first consultation flow and WebRTC signaling (SDP/ICE candidate exchange). |
| aiortc | 1.9.x | Python WebRTC implementation | Enables WebRTC on the FastAPI side if server-side media processing is needed (recording, transcoding). Uses asyncio natively. Required for proper DTLS/SRTP compliance when building custom signaling without third-party SDKs. |
| coturn | latest | Self-hosted STUN/TURN server | The de facto open-source TURN server. Required when peers cannot establish direct P2P connections (NAT traversal). Deployed via Docker. Google's public STUN (`stun.l.google.com:19302`) handles most STUN cases for free; coturn is for TURN relay fallback. |

**Note on WebRTC signaling architecture:** FastAPI handles WebSocket signaling (SDP offer/answer, ICE candidates). The browser-to-browser WebRTC media stream never passes through the backend. coturn only activates as a relay when P2P fails.

---

### Authentication and Security

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PyJWT | 2.x | JWT token creation/verification | **FastAPI officially migrated docs from python-jose to PyJWT** (PR #11589 merged). python-jose is effectively abandoned (last release 3 years ago, generates deprecation warnings in Python 3.12). PyJWT is actively maintained and lightweight. |
| pwdlib[argon2] | 0.2.x | Password hashing | FastAPI docs now recommend `pwdlib` over passlib. passlib is unmaintained (last release 2022, breaks with Python 3.11's deprecated `crypt` module). `pwdlib` with Argon2 backend is the OWASP-recommended choice for 2025 — superior resistance to GPU attacks vs bcrypt. |
| cryptography | 42.x+ | TLS, RSA key operations | Dependency of PyJWT when using RS256/ES256 algorithms. Also needed for encrypting PHI fields at rest. |
| SlowAPI | 0.1.x | API rate limiting | Built on limits library, designed specifically for FastAPI/Starlette. Uses Redis backend in production for distributed rate limiting. Essential for healthcare APIs to prevent brute-force attacks on auth endpoints. |

---

### Caching and Background Tasks

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Redis | 7.x | Cache + message broker + rate limit backend | Required for: (1) SlowAPI distributed rate limiting, (2) Celery task broker, (3) WebSocket presence/session state across multiple FastAPI workers, (4) caching doctor availability queries. |
| Celery | 5.4.x | Background task queue | The production standard for Python async tasks. Handles: appointment reminders, email notifications, prescription processing, payout triggers. Use `celery[redis]==5.4.*`. |
| Celery Beat | (with Celery 5.4.x) | Periodic task scheduling | For scheduled jobs: daily appointment reminders, commission settlement runs, prescription expiry notifications. Use Redis-based distributed locking to prevent duplicate Beat schedulers. |

---

### Payments

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Stripe Python SDK | 11.x | Payment processing + marketplace payouts | `stripe==11.x` (Python). Stripe Connect is the only mature solution for multi-sided marketplace payments with automatic commission splits, doctor/pharmacist onboarding (KYC), and payout scheduling. Alternatives (PayPal, Razorpay) are significantly inferior for commission marketplace models. |

**Stripe Connect model for this app:** Collect from patient → retain platform commission → transfer remainder to doctor/pharmacist connected accounts. Use `application_fee_amount` on PaymentIntents.

---

### File Storage

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| boto3 | 1.34.x | AWS S3 / MinIO SDK | `boto3` works with both AWS S3 (production) and MinIO (local development). S3-compatible API means same code runs everywhere. Use for prescription PDFs, patient documents, profile photos. |
| MinIO | latest | Local S3-compatible object store | Run via Docker in development. Eliminates AWS costs during dev. Identical API to S3, so `boto3` code is portable without change. |
| python-multipart | 0.0.9+ | Multipart form/file upload parsing | Required by FastAPI for `UploadFile`. Without it, file upload endpoints raise a 422 error. Install alongside FastAPI. |

---

### Email

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Resend Python SDK | 2.x | Transactional email | Developer-friendly API with excellent deliverability. Has native FastAPI integration guide. Better DX than SendGrid for a new project. Use for: appointment confirmations, prescription notifications, OTP, payout receipts. |

---

### Frontend Core Libraries

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| TanStack Query (React Query) | 5.x | Server state management + data fetching | The standard for REST API integration in React/Next.js 2025. Handles caching, background refetch, optimistic updates. Works with App Router's Server Components via prefetch/dehydration. Use with Axios for interceptors. |
| Axios | 1.7.x | HTTP client | Use with TanStack Query. Interceptors are essential: attach JWT Bearer token to every request, handle 401 refresh flows, normalize error responses. Fetch API lacks interceptors, making token refresh logic messy. |
| Zustand | 4.x | Client-side state management | Lightweight alternative to Redux. Use only for truly client-side state: current user session info, WebSocket connection status, call state (in/ongoing/ended). Do NOT use for server data — that belongs in TanStack Query. |
| React Hook Form | 7.x | Form state management | Minimal re-renders, uncontrolled components. Essential for healthcare forms (patient intake, doctor onboarding, prescription writing) which are complex and multi-step. |
| Zod | 3.x | Schema validation | TypeScript-first validation. Pair with React Hook Form via `@hookform/resolvers/zod`. Share schemas between frontend validation and (if desired) backend — same shape as Pydantic models. |
| shadcn/ui | latest (v2-era) | UI component library | Not a package — installs components as local source files. Built on Radix UI primitives + Tailwind CSS. Accessible, customizable, widely adopted for healthcare dashboards in 2025. |
| Tailwind CSS | 4.x | Utility-first CSS | Pairs with shadcn/ui. Tailwind v4 is stable and the current standard. Enables rapid iteration on the multi-dashboard UI (patient, doctor, pharmacist, admin). |

---

### Frontend Real-Time (Client-Side)

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| Native WebSocket API | (browser built-in) | Chat + WebRTC signaling connection to FastAPI | No library needed. Browser's `WebSocket` constructor connects to FastAPI's WebSocket endpoint for chat messages and WebRTC signal exchange. |
| Simple-peer or native RTCPeerConnection | — | WebRTC peer connection management | For the video/audio call escalation. If keeping it entirely dependency-free, use browser's native `RTCPeerConnection` API directly. Simple-peer is a thin wrapper if you prefer abstraction. Given the "no third-party SDKs" constraint, native `RTCPeerConnection` is the correct choice. |

---

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Docker + Docker Compose | Local dev environment | Containerize FastAPI, PostgreSQL, Redis, MinIO, coturn for consistent local setup. Also matches production deployment. |
| Uvicorn | FastAPI ASGI server | Use `uvicorn --reload` in dev. In production: `gunicorn -k uvicorn.workers.UvicornWorker` with multiple workers. |
| pytest + pytest-asyncio | Backend testing | Use `httpx.AsyncClient` with `ASGITransport` for async endpoint tests. Avoid FastAPI's synchronous `TestClient` for async apps — it can create inconsistent event loop behavior. |
| httpx | HTTP client for tests | Required for `AsyncClient` in pytest. Also usable as production HTTP client for internal service calls. |
| ESLint + Prettier | Frontend code quality | Standard Next.js setup. Configure ESLint with TypeScript rules. |
| Vitest + React Testing Library | Frontend testing | Vitest is faster than Jest for Vite/Next.js codebases. React Testing Library for component tests. |

---

## Installation

```bash
# Backend (Python 3.12+)
pip install fastapi==0.115.* uvicorn[standard] sqlalchemy==2.0.* asyncpg==0.28.* alembic
pip install pyjwt[crypto] pwdlib[argon2] python-multipart
pip install celery[redis]==5.4.* redis slowapi
pip install stripe boto3 resend
pip install aiortc  # Only if server-side WebRTC media processing is needed

# Backend dev dependencies
pip install pytest pytest-asyncio httpx

# Frontend (Node 20+)
npx create-next-app@latest --typescript --tailwind --app

# Frontend core
npm install @tanstack/react-query axios zustand
npm install react-hook-form zod @hookform/resolvers

# shadcn/ui (installs components as source, not a package)
npx shadcn@latest init

# Frontend dev
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| PyJWT | python-jose | Never — python-jose is abandoned and breaks on Python 3.12 |
| pwdlib[argon2] | passlib[bcrypt] | Never for new projects — passlib is unmaintained, bcrypt is weaker than Argon2 |
| asyncpg (pinned <0.29) | psycopg3 (async) | psycopg3 is a valid modern alternative if SQLAlchemy 2.1+ is used; currently asyncpg has the most production usage |
| SQLAlchemy 2.0 | SQLModel | SQLModel is fine for small projects but adds abstraction complexity; for a multi-role healthcare app, raw SQLAlchemy gives more control over complex queries |
| Celery + Redis | FastAPI BackgroundTasks | Use `BackgroundTasks` only for fire-and-forget tasks that don't need retries, persistence, or scheduling. Appointment reminders and payouts need Celery. |
| Stripe Connect | PayPal / Razorpay | Only if targeting markets where Stripe is unavailable (e.g., India-first, use Razorpay). Stripe Connect's marketplace split payment model is unmatched. |
| TanStack Query + Axios | SWR + fetch | SWR is simpler but lacks the full mutation/cache invalidation power needed for complex healthcare workflows (prescriptions, orders, appointments). |
| Resend | SendGrid | SendGrid when you need enterprise deliverability at scale (>100K emails/day) or need advanced marketing features. For transactional email on a new project, Resend has better DX. |
| coturn (self-hosted) | Twilio TURN / Metered TURN | Use managed TURN if self-hosting is operationally unacceptable. Twilio TURN is reliable but adds vendor dependency. For a "no third-party SDKs" WebRTC build, self-hosted coturn is the right call. |
| MinIO (local dev) | LocalStack | MinIO is more lightweight and S3-compatible. LocalStack adds AWS service emulation you don't need. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| python-jose | Abandoned (last release 2021), breaks Python 3.12 with deprecation warnings, security library with no active maintenance is a liability | PyJWT 2.x |
| passlib | Unmaintained since 2022, uses Python's deprecated `crypt` module, breaks silently on Python 3.11+ | pwdlib[argon2] |
| FastAPI's built-in `BackgroundTasks` for email/reminders | No retry on failure, no persistence across restarts, not schedulable — will silently lose tasks in production | Celery 5.4.x with Redis |
| Third-party WebRTC SDKs (Daily, Twilio Video, Vonage) | Violates the project constraint of "no third-party SDKs" for real-time; also creates vendor lock-in and per-minute billing on a consultation platform | Native RTCPeerConnection + coturn |
| Synchronous PostgreSQL drivers (psycopg2) in async FastAPI | Blocks the event loop — all async performance gains are lost. One slow query stalls the entire server worker | asyncpg (async driver) |
| Redux (Redux Toolkit) for client state | Heavyweight for this use case; Zustand covers the same ground with 1/10th the boilerplate | Zustand 4.x |
| `Base.metadata.create_all()` in app startup | Bypasses migration history, creates schema drift, makes rollbacks impossible | Alembic migrations only |
| Hardcoded SECRET_KEY in code | Catastrophic security failure in healthcare context — PHI exposure, JWT forgery | Environment variables + secrets manager (AWS Secrets Manager / Vault in production) |

---

## Stack Patterns by Variant

**For the WebSocket chat (consultation chat messages):**
- FastAPI `@app.websocket("/ws/{consultation_id}")` endpoint
- Store message history in PostgreSQL (persisted)
- Use Redis pub/sub for broadcasting messages across multiple FastAPI worker processes
- Client uses native browser `WebSocket` API

**For WebRTC video/audio call escalation:**
- FastAPI WebSocket acts as the signaling server (SDP offer/answer exchange, ICE candidates)
- Browser uses native `RTCPeerConnection` with STUN: `stun.l.google.com:19302`
- TURN fallback: self-hosted coturn instance
- Server does NOT relay media — P2P connection between browser peers

**For prescription PDF generation:**
- Generate on the server with `reportlab` or `weasyprint` (Python PDF libraries)
- Store in S3/MinIO with a time-limited presigned URL for download
- Link in the patient's consultation record in PostgreSQL

**For doctor/pharmacist onboarding (Stripe Connect):**
- Use Stripe Connect Express accounts (Stripe handles KYC)
- Do NOT use Custom accounts — the compliance burden is too high for a new platform
- Application fee taken at charge time, automatic payouts to connected accounts

**For multi-role RBAC (patient, doctor, pharmacist, admin):**
- Encode `role` claim in JWT payload
- FastAPI dependency functions check role per endpoint
- Row-level security in PostgreSQL as a secondary defense layer for PHI

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| FastAPI 0.115.x | Pydantic 2.12.x | Pydantic v2 is required; v1 compatibility shim exists but avoid it for new code |
| SQLAlchemy 2.0.41 | asyncpg 0.28.x | **Pin asyncpg < 0.29.0** — 0.29.0+ has breaking compatibility with `create_async_engine` in SQLAlchemy 2.0.x series |
| Next.js 16.x | React 19.x | App Router requires React 19. Verify any third-party component libraries support React 19 before installing. |
| Tailwind CSS 4.x | shadcn/ui latest | shadcn/ui updated for Tailwind v4 in 2025. Do not mix Tailwind v3 configs with v4. |
| Celery 5.4.x | Redis 7.x | Use `celery[redis]==5.4.*` — the Redis integration is bundled. |
| PyJWT 2.x | cryptography 42.x+ | cryptography is a peer dependency of PyJWT when using asymmetric algorithms (RS256, ES256). |

---

## Sources

- FastAPI official release notes — https://fastapi.tiangolo.com/release-notes/ (version 0.115.14 confirmed July 2025)
- FastAPI JWT migration to PyJWT — https://github.com/fastapi/fastapi/pull/11589 (official PR, MEDIUM-HIGH confidence)
- SQLAlchemy 2.0.38 release — https://www.sqlalchemy.org/blog/2025/02/06/sqlalchemy-2.0.38-released/ (asyncpg compatibility note)
- Pydantic v2 current version — https://pypi.org/project/pydantic/ (v2.12.x confirmed current)
- Next.js 16.1 release — https://releasebot.io/updates/vercel/next-js (December 2025)
- FastAPI + pwdlib recommendation — https://www.francoisvoron.com/blog/introducing-pwdlib-a-modern-password-hash-helper-for-python
- FastAPI best practices — https://github.com/zhanymkanov/fastapi-best-practices (HIGH confidence, widely referenced)
- WebRTC + FastAPI signaling — https://dev.to/wassafshahzad/building-real-time-communication-harnessing-webrtc-with-fastapi-part-1-ael
- coturn self-hosted setup — https://webrtc.ventures/2025/01/how-to-set-up-self-hosted-stun-turn-servers-for-webrtc-applications/
- Stripe Connect marketplace docs — https://stripe.com/connect/marketplaces (official, HIGH confidence)
- SlowAPI rate limiting — https://github.com/laurentS/slowapi (active, designed for FastAPI)
- Celery + Redis + FastAPI 2025 — https://medium.com/@dewasheesh.rana/celery-redis-fastapi-the-ultimate-2025-production-guide-broker-vs-backend-explained-5b84ef508fa7
- shadcn/ui + Next.js — https://ui.shadcn.com/docs/installation/next (official)
- TanStack Query + Next.js App Router — https://www.storieasy.com/blog/integrate-tanstack-query-with-next-js-app-router-2025-ultimate-guide
- Resend + FastAPI — https://resend.com/fastapi (official integration guide)

---

*Stack research for: Healthcare telemedicine marketplace (HealthConnect)*
*Researched: 2026-03-19*
