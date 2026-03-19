# Architecture Research

**Domain:** Healthcare / Telemedicine Marketplace (Multi-sided: Patients, Doctors, Pharmacists, Admins)
**Researched:** 2026-03-19
**Confidence:** MEDIUM-HIGH (architecture patterns well-documented; specific WebRTC+FastAPI+Next.js combo verified via official docs and community sources)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │   Patient    │  │    Doctor    │  │ Pharmacist   │  │  Admin  │ │
│  │   Portal     │  │  Dashboard   │  │  Dashboard   │  │  Panel  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────┬────┘ │
└─────────┼─────────────────┼─────────────────┼───────────────┼──────┘
          │  HTTPS/WS/WebRTC│                 │               │
┌─────────┼─────────────────┼─────────────────┼───────────────┼──────┐
│         │         API GATEWAY / REVERSE PROXY (Nginx)       │      │
├─────────┼─────────────────┼─────────────────┼───────────────┼──────┤
│                    BACKEND SERVICES LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  REST API    │  │  WebSocket   │  │   WebRTC Signaling       │  │
│  │  (FastAPI)   │  │  Handler     │  │   Server (FastAPI WS)    │  │
│  │              │  │  (Chat)      │  │                          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────────┘  │
│         │                 │                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    DOMAIN SERVICES                           │   │
│  │  Auth │ Users │ Doctors │ Appointments │ Consultations       │   │
│  │  Prescriptions │ Pharmacy │ Orders │ Payments │ Notifications│   │
│  └──────────────────────────┬───────────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────────┐
│                    DATA LAYER                                        │
│  ┌──────────────┐  ┌────────┴─────┐  ┌──────────────┐              │
│  │  PostgreSQL  │  │    Redis     │  │  File Store  │              │
│  │  (primary)   │  │  (WS rooms,  │  │  (prescripts,│              │
│  │              │  │   sessions,  │  │   avatars)   │              │
│  │              │  │   cache)     │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### WebRTC + WebSocket Communication Detail

```
Consultation Room — Media Escalation Flow:

Patient ←──── WebSocket (chat) ────→ FastAPI WS Handler
Doctor  ←──── WebSocket (chat) ────→ FastAPI WS Handler
                                            │
                                     Redis Pub/Sub
                                     (fan-out msgs
                                      across workers)

Patient ←──── WebRTC Signaling ────→ FastAPI WS Signaling
Doctor  ←──── WebRTC Signaling ────→   (offer/answer/ICE)
         ↘                         ↗
          Peer-to-Peer Media Stream
          (audio/video bypass server)
```

---

## Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|---------------|----------------|
| Patient Portal | Doctor search, booking, consultation UI, prescription view, pharmacy ordering | Next.js App Router, React Server Components |
| Doctor Dashboard | Availability management, appointment queue, consultation room, prescription writer | Next.js App Router, role-guarded routes |
| Pharmacist Dashboard | Inventory management, prescription fulfillment, order tracking | Next.js App Router, role-guarded routes |
| Admin Panel | User management, commission settings, platform analytics, dispute handling | Next.js App Router, admin-only routes |
| REST API (FastAPI) | All CRUD operations, business logic, authentication, payment processing | FastAPI routers organized by domain |
| WebSocket Handler (Chat) | Real-time chat messages within consultation rooms, typing indicators, read receipts | FastAPI WebSocket + Redis pub/sub for multi-worker |
| WebRTC Signaling Server | Exchange SDP offers/answers and ICE candidates between peers; does NOT carry media | FastAPI WebSocket (reuses WS infrastructure) |
| Auth Service | JWT issuance, refresh, RBAC for 4 roles (patient/doctor/pharmacist/admin) | FastAPI + python-jose, role middleware |
| Consultation Service | Consultation lifecycle (pending → active → chat → audio → video → closed), prescription linking | FastAPI domain service |
| Pharmacy Service | Prescription-linked orders, OTC catalogue, inventory, order fulfillment states | FastAPI domain service |
| Payment Service | Collect from patient, calculate commission, queue payout to doctor/pharmacy | FastAPI + Stripe or payment gateway |
| Notification Service | Appointment reminders, consultation events, order status updates | WebSocket push + email fallback |
| PostgreSQL | Primary persistent store for all entities | SQLAlchemy async + Alembic migrations |
| Redis | WebSocket room state, session cache, pub/sub message bus for multi-worker WS | redis-py async |

---

## Recommended Project Structure

```
healthcare/                         # Monorepo root
├── backend/                        # FastAPI application
│   ├── app/
│   │   ├── main.py                 # App factory, routers registered here
│   │   ├── core/
│   │   │   ├── config.py           # Settings (pydantic-settings)
│   │   │   ├── security.py         # JWT logic, password hashing
│   │   │   └── dependencies.py     # Shared FastAPI Depends() functions
│   │   ├── db/
│   │   │   ├── base.py             # SQLAlchemy Base + session factory
│   │   │   └── migrations/         # Alembic
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── doctor.py
│   │   │   ├── appointment.py
│   │   │   ├── consultation.py
│   │   │   ├── prescription.py
│   │   │   ├── medicine.py
│   │   │   ├── order.py
│   │   │   └── payment.py
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   │   └── [mirrors models/]
│   │   ├── routers/                # FastAPI route handlers (thin)
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── doctors.py
│   │   │   ├── appointments.py
│   │   │   ├── consultations.py
│   │   │   ├── prescriptions.py
│   │   │   ├── pharmacy.py
│   │   │   ├── orders.py
│   │   │   └── payments.py
│   │   ├── services/               # Business logic (called by routers)
│   │   │   ├── consultation_service.py
│   │   │   ├── prescription_service.py
│   │   │   ├── payment_service.py
│   │   │   └── notification_service.py
│   │   └── ws/                     # WebSocket handlers
│   │       ├── connection_manager.py   # Local WS connection registry
│   │       ├── chat.py                 # Chat room WebSocket endpoint
│   │       └── signaling.py            # WebRTC signaling WebSocket endpoint
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                       # Next.js application
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # Login, register pages
│   │   ├── (patient)/              # Patient-scoped routes
│   │   │   ├── doctors/            # Search + doctor profiles
│   │   │   ├── appointments/       # Booking + appointment list
│   │   │   ├── consultations/      # Consultation room
│   │   │   ├── prescriptions/      # Prescription viewer
│   │   │   └── pharmacy/           # OTC + prescription orders
│   │   ├── (doctor)/               # Doctor-scoped routes
│   │   │   ├── dashboard/
│   │   │   ├── availability/
│   │   │   ├── appointments/
│   │   │   ├── consultations/
│   │   │   └── prescriptions/
│   │   ├── (pharmacist)/           # Pharmacist-scoped routes
│   │   │   ├── inventory/
│   │   │   └── orders/
│   │   └── (admin)/                # Admin-scoped routes
│   │       ├── users/
│   │       ├── commissions/
│   │       └── analytics/
│   ├── components/
│   │   ├── consultation/
│   │   │   ├── ChatWindow.tsx      # WebSocket chat
│   │   │   ├── VideoCall.tsx       # WebRTC peer connection
│   │   │   └── MediaControls.tsx   # Mic/camera/escalate UI
│   │   └── shared/
│   ├── lib/
│   │   ├── api/                    # Generated/manual API client
│   │   ├── websocket.ts            # WS connection hook
│   │   └── webrtc.ts               # WebRTC peer connection logic
│   ├── package.json
│   └── Dockerfile
└── .planning/
```

### Structure Rationale

- **backend/app/routers/:** Thin route handlers only — call services, return schemas. No business logic here.
- **backend/app/services/:** All stateful operations, cross-entity coordination, payment math. Testable in isolation.
- **backend/app/ws/:** Isolated from REST — separate connection lifecycle, needs Redis for multi-worker broadcast.
- **frontend/app/(role)/:** Route groups enforce role-based navigation structure; middleware guards each group.
- **frontend/components/consultation/:** WebRTC and WebSocket UI isolated — complex state, should not bleed into other components.

---

## Architectural Patterns

### Pattern 1: Router → Service → Repository (Layered)

**What:** Route handlers delegate to service layer; services use SQLAlchemy for data access. No ORM queries in routes.
**When to use:** All REST endpoints. Keeps routes thin and services testable.
**Trade-offs:** Small overhead for simple CRUD; worth it because consultation and payment logic gets complex.

**Example:**
```python
# routers/appointments.py
@router.post("/appointments", response_model=AppointmentOut)
async def create_appointment(
    data: AppointmentCreate,
    current_user: User = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    return await appointment_service.book(db, patient=current_user, data=data)

# services/appointment_service.py
async def book(db: AsyncSession, patient: User, data: AppointmentCreate) -> Appointment:
    # Check doctor availability, prevent double-booking, create appointment
    ...
```

### Pattern 2: WebSocket Room Manager + Redis Pub/Sub

**What:** Each FastAPI worker maintains a local dict of active WebSocket connections keyed by consultation room ID. Redis pub/sub bridges messages across workers.
**When to use:** Chat rooms, real-time notifications — any case where a message from one user must reach another user potentially on a different uvicorn worker.
**Trade-offs:** Adds Redis dependency; adds ~1ms latency per message. Required for multi-worker production deployments.

**Example:**
```python
# ws/connection_manager.py
class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, room_id: str):
        await ws.accept()
        self.rooms.setdefault(room_id, []).append(ws)

    async def broadcast_local(self, room_id: str, message: str):
        for ws in self.rooms.get(room_id, []):
            await ws.send_text(message)

    async def disconnect(self, ws: WebSocket, room_id: str):
        self.rooms.get(room_id, []).remove(ws)
```

### Pattern 3: WebRTC Signaling via Existing WebSocket Infrastructure

**What:** The same WebSocket connection used for chat carries WebRTC signaling messages (offer, answer, ICE candidates). Message type field discriminates chat vs. signaling.
**When to use:** Escalation from chat to audio/video within an active consultation room.
**Trade-offs:** Simpler — one connection per consultation, not two. The media stream itself is peer-to-peer and never touches the server.

**Example message envelope:**
```typescript
// Shared message type
type ConsultationMessage =
  | { type: "chat"; text: string; sender_id: string }
  | { type: "rtc_offer"; sdp: RTCSessionDescriptionInit; target_id: string }
  | { type: "rtc_answer"; sdp: RTCSessionDescriptionInit; target_id: string }
  | { type: "rtc_ice"; candidate: RTCIceCandidateInit; target_id: string }
  | { type: "escalate"; to: "audio" | "video" }
  | { type: "consultation_end" };
```

### Pattern 4: Role-Based Route Groups (Next.js App Router)

**What:** Use Next.js route groups `(patient)`, `(doctor)`, `(pharmacist)`, `(admin)` with a `middleware.ts` at the root that reads the JWT role claim and redirects unauthorized access.
**When to use:** Always — this is how Next.js App Router is designed to handle RBAC.
**Trade-offs:** None meaningful. Avoids the anti-pattern of putting role checks inside every page component.

---

## Data Flow

### Request Flow: Patient Books Appointment

```
Patient UI (Next.js)
    ↓  POST /api/appointments
Next.js API Route or direct FastAPI call
    ↓
FastAPI Router (appointments.py)
    ↓  validates JWT, extracts patient_id
Appointment Service
    ↓  check doctor availability (DB read)
    ↓  prevent double-booking (DB read with row lock)
    ↓  create appointment record (DB write)
    ↓  queue notification to doctor
PostgreSQL
    ↓
Response → Patient UI (booking confirmation)
Doctor WebSocket notification (async, Redis pub/sub)
```

### Real-Time Consultation Flow: Chat → Video Escalation

```
1. CONSULTATION START
   Patient/Doctor JOIN room → WebSocket connect → ConnectionManager.connect(ws, consultation_id)

2. CHAT PHASE
   Message sent → WebSocket → ConnectionManager → Redis pub/sub publish
   Redis → all workers subscribed → ConnectionManager.broadcast_local → other peer
   Message persisted to PostgreSQL asynchronously (for consultation records)

3. ESCALATION TO VIDEO
   Doctor sends { type: "escalate", to: "video" } → WebSocket → other peer
   Patient UI: getUserMedia() → createPeerConnection() → createOffer()
   Offer → { type: "rtc_offer", sdp: ... } → WebSocket (signaling relay)
   Server relays to doctor (no SDP inspection — pure relay)
   Doctor → createAnswer() → { type: "rtc_answer" } → relay back
   ICE candidates exchanged same way
   STUN resolves public IPs → P2P media stream established
   Media audio/video NEVER touches FastAPI server

4. CONSULTATION END
   { type: "consultation_end" } → WebSocket
   Doctor writes prescription (REST API) → linked to consultation_id
   WebSocket connections closed
```

### Prescription-to-Pharmacy Flow

```
Doctor (post-consultation)
    ↓  POST /api/prescriptions  { consultation_id, medicines: [...] }
FastAPI → Prescription Service
    ↓  create prescription linked to consultation + patient
    ↓  set status: "pending_fulfillment"
Patient notified (WebSocket push or polling)
    ↓
Patient visits Pharmacy section
    ↓  GET /api/pharmacy/orders?prescription_id=...
FastAPI returns available fulfillment options
    ↓
Patient confirms order → POST /api/orders
Payment Service
    ↓  charge patient total
    ↓  record platform commission
    ↓  queue payout to pharmacy
Pharmacist Dashboard
    ↓  sees order in queue
    ↓  updates order status: processing → shipped → delivered
Patient notified on status changes
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1K users | Single uvicorn worker, in-memory WS connection manager (no Redis needed), single PostgreSQL instance |
| 1K-10K users | Multiple uvicorn workers → Redis pub/sub required for WS, PostgreSQL read replicas for doctor search queries, connection pooling with asyncpg |
| 10K-100K users | TURN server needed (a fraction of WebRTC calls fail with STUN alone behind symmetric NAT), PostgreSQL partitioning on consultation_messages by date, Redis Cluster |
| 100K+ users | Separate WebSocket service from REST API, media relay server (coturn) for video calls, CDN for frontend static assets |

### Scaling Priorities

1. **First bottleneck: WebSocket fan-out** — single worker can handle ~10K connections, but multi-worker deployments need Redis pub/sub immediately. Add Redis before deploying multiple uvicorn workers.
2. **Second bottleneck: Doctor availability queries** — high-read, complex availability logic. Add PostgreSQL read replica and cache availability slots in Redis with short TTL.
3. **Third bottleneck: WebRTC NAT traversal** — STUN servers (Google's free ones) work for ~80% of users. The remaining ~20% behind symmetric NAT need a TURN relay server (coturn, self-hosted).

---

## Anti-Patterns

### Anti-Pattern 1: Putting WebSocket Business Logic in Route Handlers

**What people do:** Large `@app.websocket("/ws/...")` functions with all chat, signaling, and notification logic inline.
**Why it's wrong:** Becomes untestable, hard to extend, and breaks when you add multi-worker support (Redis pub/sub can't be bolted on cleanly).
**Do this instead:** `ConnectionManager` class handles transport; separate `chat_handler` and `signaling_handler` functions handle message routing; Redis pub/sub wired into `ConnectionManager.broadcast`.

### Anti-Pattern 2: Storing WebRTC Media on the Server

**What people do:** Routing audio/video through the FastAPI WebSocket server to record calls or handle poor-connectivity clients.
**Why it's wrong:** Destroys the latency advantage of WebRTC, creates massive bandwidth costs, requires a media server (mediasoup, Janus) — a completely different architectural component.
**Do this instead:** For this project scope, keep WebRTC purely peer-to-peer. If call recording is needed later, evaluate dedicated media server or cloud recording services.

### Anti-Pattern 3: Single User Table with Role Flag

**What people do:** `users` table with a `role` column ('patient'|'doctor'|'pharmacist'|'admin'), all profile data in the same table.
**Why it's wrong:** Doctors have specialties, qualifications, availability, ratings. Pharmacists have pharmacy associations. A single table becomes sparse and migrations get messy.
**Do this instead:** `users` table for auth identity + shared fields. Separate `doctor_profiles`, `pharmacist_profiles` tables linked by `user_id` foreign key. Patient-specific data in `patient_profiles`. Role flag stays on `users` for auth, but domain data lives in its own table.

### Anti-Pattern 4: Polling for Consultation Status

**What people do:** Frontend polls `GET /api/consultations/{id}` every few seconds to check if doctor joined, prescription was written, etc.
**Why it's wrong:** 100 users in active consultations = hundreds of requests per minute. Creates unnecessary DB load and poor UX (notification delay).
**Do this instead:** Use the existing WebSocket connection to push consultation state changes. `{ type: "consultation_status", status: "doctor_joined" }` over the chat WS. REST API for initial load; WS for live updates.

### Anti-Pattern 5: Prescription as a Free-Text Field

**What people do:** Doctor writes prescription as a text blob attached to consultation notes.
**Why it's wrong:** Cannot link to pharmacy inventory, cannot trigger ordering flow, cannot validate drug interactions later, impossible to build the "patient buys medicine from prescription" feature.
**Do this instead:** `prescriptions` table with structured `prescription_items` (medicine_id, dosage, frequency, duration). `medicine_id` is a foreign key to the `medicines` catalogue. This enables the pharmacy ordering flow.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| STUN Server (Google: stun.l.google.com) | Client-side WebRTC config (no server call) | Free, used for NAT traversal. No cost for this scale. |
| Payment Gateway (Stripe recommended) | REST API from FastAPI Payment Service | Handles charge + payout split. Store payment_intent_id in `payments` table. |
| Email Service (SendGrid/SES) | HTTP from Notification Service, async task | For appointment confirmations, prescription ready notices |
| File Storage (S3-compatible) | boto3 from FastAPI for prescription PDFs, profile images | Pre-signed URLs for client-side upload; never expose bucket credentials to frontend |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Next.js frontend ↔ FastAPI REST | HTTP/HTTPS JSON REST | Use OpenAPI-generated TypeScript client for type safety |
| Next.js frontend ↔ FastAPI WS | WebSocket (ws://, wss://) | One persistent connection per active consultation; reconnect on drop |
| FastAPI REST ↔ FastAPI WS | Shared PostgreSQL + Redis | REST writes DB; WS reads state from Redis; no direct cross-call |
| FastAPI worker A ↔ FastAPI worker B | Redis pub/sub | Required when uvicorn runs multiple workers; all WS broadcasts go through Redis |
| Consultation Service ↔ Pharmacy Service | Internal Python import (same process) | When prescription is finalized, consultation_service calls pharmacy_service to trigger order availability |
| Payment Service ↔ Order Service | Internal Python import | Order creation triggers payment charge; charge success triggers order confirmation |

---

## Build Order (Phase Dependencies)

The component dependency chain dictates this build order:

```
1. Auth + User Model (users, roles, JWT)
        ↓
2. Doctor Profiles + Search (availability, specialties, ratings)
        ↓
3. Appointment Booking (requires users + doctors)
        ↓
4. Consultation Room — Chat (requires appointments; WebSocket + Redis)
        ↓
5. Consultation Room — WebRTC (requires chat WS already working for signaling)
        ↓
6. Prescriptions (requires completed consultations)
        ↓
7. Pharmacy — OTC Store (independent of prescriptions, can parallel with step 6)
   Pharmacy — Prescription Orders (requires prescriptions from step 6)
        ↓
8. Payments + Commissions (requires orders + consultations have prices)
        ↓
9. Admin Panel (requires all entities to exist and be manageable)
        ↓
10. Notifications (cross-cutting; add progressively from step 3 onward)
```

Steps 7 (OTC) and 3-5 can partially overlap once the user/doctor foundation is stable. Never build WebRTC before the WebSocket chat infrastructure — signaling reuses the same WS connection.

---

## Sources

- [Telemedicine Platform System Design & Architecture — CometChat](https://www.cometchat.com/blog/system-design-architecture-of-telemedicine-system)
- [Components of Telemedicine: System Architecture Overview — S-PRO](https://s-pro.io/blog/telemedicine-system-components-architecture)
- [Building a Healthcare Marketplace like Zocdoc — Arateg](https://arateg.com/blog/how-to-make-a-healthcare-marketplace-like-Zocdoc)
- [Building Real-Time Communication: WebRTC with FastAPI — DEV Community](https://dev.to/wassafshahzad/building-real-time-communication-harnessing-webrtc-with-fastapi-part-1-ael)
- [Signaling and Video Calling — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling)
- [WebSockets — FastAPI Official Docs](https://fastapi.tiangolo.com/advanced/websockets/)
- [Scaling WebSockets with PUB/SUB using Python, Redis & FastAPI — Medium](https://medium.com/@nandagopal05/scaling-websockets-with-pub-sub-using-python-redis-fastapi-b16392ffe291)
- [Generating API Clients in Monorepos with FastAPI & Next.js — Vinta Software](https://www.vintasoftware.com/blog/nextjs-fastapi-monorepo)
- [WebSockets at Scale with FastAPI and Uvicorn Workers — Medium](https://medium.com/@bhagyarana80/websockets-at-scale-with-fastapi-and-uvicorn-workers-building-real-time-systems-that-dont-break-ac2dada6cae9)
- [Advanced WebSocket Architectures in FastAPI — Medium/Hex Shift](https://hexshift.medium.com/how-to-incorporate-advanced-websocket-architectures-in-fastapi-for-high-performance-real-time-b48ac992f401)

---

*Architecture research for: Healthcare / Telemedicine Marketplace*
*Researched: 2026-03-19*
