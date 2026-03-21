# Roadmap: HealthConnect

## Overview

HealthConnect is built in five phases that follow the dependency chain of the core value loop: authenticate users → enable doctor discovery and appointment booking → deliver real-time consultation → issue and view prescriptions → give admins platform control. Each phase delivers a complete, independently verifiable capability. No phase is started until the one before it is observable and working.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Monorepo scaffold, auth for all 4 roles, PHI-safe data model, Redis infrastructure
- [x] **Phase 2: Doctor Discovery and Appointments** - Doctor profiles, availability management, patient search, appointment booking (completed 2026-03-20)
- [x] **Phase 3: Real-Time Consultation** - WebSocket chat, WebRTC audio/video escalation within one session (completed 2026-03-20)
- [x] **Phase 4: Prescriptions** - Doctor prescription writing, patient prescription records (completed 2026-03-20)
- [ ] **Phase 5: Admin Panel** - User management, doctor verification, commission configuration

## Phase Details

### Phase 1: Foundation
**Goal**: A secure, HIPAA-aware platform foundation exists that all four user roles can authenticate into
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. A new user can register with email and password and choose a role (patient, doctor, pharmacist, or admin)
  2. A logged-in user's session persists across browser refresh without being asked to log in again
  3. A logged-out user visiting any protected route is redirected to the login page
  4. A user with the wrong role (e.g., a patient accessing the doctor dashboard) is blocked with an appropriate error
  5. Patient medical data in the database is stored encrypted at rest, not in plain text
**Plans:** 6 plans

Plans:
- [ ] 01-01-PLAN.md — Backend scaffold: config, DB models with PHI encryption, Redis, JWT/security utilities, test infrastructure
- [ ] 01-02-PLAN.md — Frontend scaffold: Next.js 16, shadcn/ui, Sidebar, TopBar, proxy.ts RBAC, role layouts
- [ ] 01-03-PLAN.md — Auth API: registration, login, session, logout, lockout, email verification, admin endpoints, test suite
- [ ] 01-04-PLAN.md — Frontend auth pages: login, registration forms, email verification, forgot password, pending approval
- [ ] 01-05-PLAN.md — Dashboard pages, patient profile editing, admin applications management, end-to-end verification
- [ ] 01-06-PLAN.md — Gap closure: fix session persistence across browser refresh (AUTH-02)

### Phase 2: Doctor Discovery and Appointments
**Goal**: A patient can find a doctor and book a time slot; a doctor can manage their schedule and see their upcoming work
**Depends on**: Phase 1
**Requirements**: DISC-01, DISC-02, DISC-03, APPT-01, APPT-02
**Success Criteria** (what must be TRUE):
  1. A doctor can create a profile with specialty, qualifications, bio, and consultation fee, and the profile is publicly visible
  2. A patient can search and filter the doctor listing by specialty and see only doctors with available slots
  3. A doctor can set working hours and block specific time slots so they no longer appear bookable
  4. A patient can select an available time slot and confirm a booking, and the slot is no longer available to other patients
  5. A doctor can view their upcoming appointments dashboard showing patient name, time, and appointment details
**Plans:** 5/5 plans complete

Plans:
- [ ] 02-01-PLAN.md — Backend models, migrations, schemas, and slot generator service
- [ ] 02-02-PLAN.md — Backend API routers (doctors, availability, appointments) with integration tests
- [ ] 02-03-PLAN.md — Frontend doctor listing, profile detail, profile edit, sidebar navigation updates
- [ ] 02-04-PLAN.md — Frontend doctor schedule management and patient booking confirmation flow
- [ ] 02-05-PLAN.md — Frontend appointment views for patient and doctor, dashboard integration

### Phase 3: Real-Time Consultation
**Goal**: A patient and doctor connected by an appointment can consult in real time via chat with on-demand escalation to audio and video
**Depends on**: Phase 2
**Requirements**: CONS-01, CONS-02, CONS-03
**Success Criteria** (what must be TRUE):
  1. A patient and doctor can exchange text messages in a shared consultation room in real time with no noticeable lag
  2. Either party can initiate an escalation to audio call within the same consultation session without navigating away
  3. Either party can escalate a call to video within the same consultation session without disconnecting the audio
  4. Consultation messaging works correctly when patient and doctor connect from different browser tabs or machines (multi-worker safe)
**Plans:** 7/7 plans complete

Plans:
- [ ] 03-01-PLAN.md — Backend models, schemas, migration, and test scaffold for consultations
- [ ] 03-02-PLAN.md — Backend WebSocket endpoint, Redis pub/sub manager, REST consultation endpoints, file upload
- [ ] 03-03-PLAN.md — Frontend TypeScript types, WebSocket hook, WebRTC hook, call timer, notifications
- [ ] 03-04a-PLAN.md — Frontend consultation sub-components (MessageBubble, ReadReceipt, TimerBar, etc.)
- [ ] 03-04b-PLAN.md — Frontend ConsultationRoom container, ChatPanel, VideoPanel, CallModal, route pages
- [ ] 03-05-PLAN.md — Frontend consultation list pages and sidebar navigation updates
- [ ] 03-06-PLAN.md — "Join Consultation" entry point on appointment cards for patient and doctor

### Phase 4: Prescriptions
**Goal**: A doctor can issue a structured digital prescription at the end of a consultation, and the patient can access all their past prescriptions
**Depends on**: Phase 3
**Requirements**: PRSC-01, PRSC-02
**Success Criteria** (what must be TRUE):
  1. A doctor can open a prescription form during or after a consultation and write a structured prescription (medicine name, dosage, instructions) that is saved and linked to the consultation
  2. A patient can navigate to their prescription history and view all past prescriptions with the issuing doctor, date, and medicine details
  3. A prescription cannot be accessed or viewed by any user other than the issuing doctor and the patient it was issued to
**Plans:** 4/4 plans complete

Plans:
- [x] 04-01-PLAN.md — Backend models (Prescription, PrescriptionItem, Drug, Notification), schemas, HMAC utility, PDF service, drug seed data, test scaffold
- [x] 04-02-PLAN.md — Backend API routers (prescriptions CRUD + PDF, drugs autocomplete, notifications, consultation reopen) with integration tests
- [x] 04-03-PLAN.md — Frontend TypeScript types, prescription components (Form, Card, Detail, DrugAutocomplete, MedicineRow), NotificationPanel, Sidebar and TopBar updates
- [x] 04-04-PLAN.md — Frontend prescription pages (patient list/detail, doctor list/detail, pharmacist placeholder), ConsultationRoom Write Prescription integration

### Phase 5: Admin Panel
**Goal**: An admin can exercise full oversight of the platform — managing users across roles, verifying doctor applications, and setting commission rates
**Depends on**: Phase 2
**Requirements**: ADMN-01, ADMN-02, ADMN-03
**Success Criteria** (what must be TRUE):
  1. An admin can view a list of all users on the platform, filter by role, and suspend or activate any account
  2. An admin can review a pending doctor registration application and approve or reject it, with the outcome reflected immediately in the doctor's access
  3. An admin can set platform commission rates and the new rate is applied to subsequent transactions
**Plans:** 2/3 plans executed

Plans:
- [x] 05-01-PLAN.md — Backend: admin schemas, rejection_reason migration, extended endpoints (paginated users, suspend/activate, stats, commission CRUD), suspended auth check, integration tests
- [x] 05-02-PLAN.md — Frontend: enhanced users page (role filter, pagination, suspend/activate with toast), suspended page, proxy update, apiFetch 403 redirect
- [ ] 05-03-PLAN.md — Frontend: enhanced dashboard (stats grid, commission inline edit), enhanced applications page (profile summary card, rejection reason two-step flow)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/6 | In Progress|  |
| 2. Doctor Discovery and Appointments | 5/5 | Complete   | 2026-03-20 |
| 3. Real-Time Consultation | 7/7 | Complete   | 2026-03-20 |
| 4. Prescriptions | 4/4 | Complete   | 2026-03-20 |
| 5. Admin Panel | 2/3 | In Progress|  |
