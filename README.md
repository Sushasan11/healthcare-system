# HealthConnect

A full-stack healthcare marketplace platform connecting patients with doctors, enabling real-time consultations, digital prescriptions, and integrated pharmacy services.

## Overview

HealthConnect is a multi-sided telemedicine marketplace where patients can discover doctors by specialty, book appointments, consult via live chat or audio/video call, and receive digitally-signed prescriptions — all in one seamless flow. Doctors manage their availability and conduct consultations through a dedicated dashboard. Pharmacists fulfill prescription orders and manage inventory. Platform admins oversee users, approvals, and settings.

Patient data is protected with AES-256-GCM field-level encryption to ensure responsible handling of protected health information (PHI).

## Key Features

### Authentication and Access Control

- Multi-role user system: patient, doctor, pharmacist, and admin
- JWT access tokens with HttpOnly refresh cookie rotation
- Role-based dashboards and protected routes (role-prefixed URLs)
- Argon2 password hashing

### Doctor Discovery and Appointments

- Browse and search doctors by specialty, availability, and ratings
- Detailed doctor profiles with qualifications and reviews
- Slot-based appointment booking with conflict detection
- Doctor availability management

### Real-Time Consultation

- WebSocket-powered live chat as the primary consultation channel
- One-click escalation from chat to audio call, then to video call
- WebRTC peer-to-peer audio/video (no third-party SDK dependency)
- File and image attachments in chat, served through auth-gated endpoints

### Digital Prescriptions

- Doctors write structured prescriptions linked to consultations
- HMAC-signed prescriptions to prevent tampering
- PDF export via reportlab
- Prescription state machine (active → dispensed / expired)

### Security and Privacy

- AES-256-GCM field-level encryption for all PHI stored in the database
- HTTPS-enforced token transport; refresh token in HttpOnly cookie
- Auth-gated file downloads to prevent direct PHI URL access

### Role Dashboards

- **Patient:** appointment history, consultation records, prescriptions, medical profile
- **Doctor:** schedule management, patient consultations, prescription writing
- **Pharmacist:** prescription queue, inventory, order fulfillment
- **Admin:** user management, account approvals, platform settings

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend framework** | FastAPI (Python 3.13) |
| **ORM and migrations** | SQLAlchemy (async), Alembic |
| **Database** | PostgreSQL 15 |
| **Dependency management** | Poetry |
| **Frontend framework** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4, shadcn/ui v4 (base-nova) |
| **Real-time** | WebSocket (native), WebRTC (native — no third-party SDKs) |
| **Authentication** | PyJWT, Argon2 (pwdlib) |
| **PHI encryption** | AES-256-GCM (Python `cryptography` library) |
| **PDF generation** | reportlab |

## Project Structure

```
healthcare/
├── backend/                  # FastAPI API server
│   ├── app/
│   │   ├── core/             # Config, security utilities, PHI encryption
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── routers/          # API route handlers by domain
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   └── services/         # Business logic layer
│   ├── alembic/              # Database migration scripts
│   ├── seeds/                # Development seed data
│   └── tests/                # Pytest test suite
└── frontend/                 # Next.js web client
    ├── app/                  # App Router pages grouped by role
    │   ├── (patient)/        # /patient/* routes
    │   ├── (doctor)/         # /doctor/* routes
    │   ├── (pharmacist)/     # /pharmacist/* routes
    │   └── (admin)/          # /admin/* routes
    ├── components/           # Reusable UI components
    ├── hooks/                # Custom React hooks
    ├── lib/                  # Utilities, API client, helpers
    ├── types/                # TypeScript type definitions
    └── proxy.ts              # RBAC API proxy (role-based route enforcement)
```

## Prerequisites

- **Python** 3.13 or higher
- **Node.js** 20 or higher
- **PostgreSQL** 15 or higher
- **Poetry** (Python dependency manager) — install via `pip install poetry` or see [python-poetry.org](https://python-poetry.org)

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd healthcare
```

### 2. Backend setup

```bash
cd backend

# Install Python dependencies
poetry install

# Copy environment configuration
cp .env.example .env
# Edit .env — set DATABASE_URL, SECRET_KEY, and other required variables

# Run database migrations
poetry run alembic upgrade head

# (Optional) Seed development data
poetry run python seeds/seed.py

# Start the development server
poetry run uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

### 3. Frontend setup

```bash
cd frontend

# Install Node dependencies
npm install

# Copy environment configuration
cp .env.local.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL and other required variables

# Start the development server
npm run dev
```

The web client will be available at `http://localhost:3000`.

### Environment variables

Key backend variables (see `.env.example` for the full list):

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (async, e.g. `postgresql+asyncpg://...`) |
| `DATABASE_URL_SYNC` | PostgreSQL connection string (sync, used by Alembic) |
| `SECRET_KEY` | JWT signing secret — generate a strong random value |
| `PHI_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM PHI field encryption |
| `SMTP_*` | Email server settings for notifications |

## API Documentation

FastAPI generates interactive API documentation automatically:

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **OpenAPI JSON:** `http://localhost:8000/openapi.json`

## License

License not yet determined.
