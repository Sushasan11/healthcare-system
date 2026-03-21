# Requirements: HealthConnect

**Defined:** 2026-03-19
**Core Value:** A patient can discover a doctor, book an appointment, have a real-time consultation (chat → call → video escalation), receive a prescription, and buy medicines — all in one seamless flow.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can register with email and password as patient, doctor, pharmacist, or admin
- [x] **AUTH-02**: User can log in and session persists across browser refresh (JWT)
- [x] **AUTH-03**: Role-based access control restricts endpoints by user role
- [x] **AUTH-04**: User can log out from any page

### Doctor Discovery

- [x] **DISC-01**: Doctor can create profile with specialty, qualifications, bio, and consultation fee
- [x] **DISC-02**: Patient can search and filter doctors by specialty, availability, and ratings
- [x] **DISC-03**: Doctor can manage availability by setting working hours and blocking time slots

### Appointments

- [x] **APPT-01**: Patient can select an available time slot and book an appointment with a doctor
- [x] **APPT-02**: Doctor can view upcoming appointments with patient info on a dashboard

### Consultation

- [x] **CONS-01**: Patient and doctor can have a real-time text chat consultation via WebSocket
- [x] **CONS-02**: Either party can escalate chat to audio call during consultation (WebRTC)
- [x] **CONS-03**: Either party can escalate to video call during consultation (WebRTC)

### Prescriptions

- [x] **PRSC-01**: Doctor can write a structured digital prescription during or after consultation
- [x] **PRSC-02**: Patient can view all past prescriptions linked to consultations

### Admin

- [x] **ADMN-01**: Admin can view and manage all users across roles (view, suspend, activate)
- [x] **ADMN-02**: Admin can review and approve/reject doctor registration applications
- [x] **ADMN-03**: Admin can configure platform commission rates

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Pharmacy

- **PHRM-01**: Patient can browse and purchase OTC medicines (catalog, cart, checkout)
- **PHRM-02**: Patient can order prescribed medicines linked to consultation prescription
- **PHRM-03**: Pharmacist can manage prescription queue and fulfill orders
- **PHRM-04**: Pharmacist can manage inventory (add, edit, stock levels, low-stock alerts)

### Payments

- **PYMT-01**: Patient pays consultation fee at booking
- **PYMT-02**: Platform collects commission and pays out to doctors
- **PYMT-03**: Doctor can view earnings and payout history

### Notifications

- **NOTF-01**: Patient receives booking confirmation email
- **NOTF-02**: Patient receives appointment reminder notifications
- **NOTF-03**: Patient receives notification when prescription is ready

### Enhanced Consultation

- **ECON-01**: Patient can view consultation history with transcripts
- **ECON-02**: Real-time typing indicators during chat consultation
- **ECON-03**: Post-consultation follow-up messaging within a window

### Analytics

- **ANLT-01**: Admin can view platform analytics dashboard (consultations, revenue, active users)

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI symptom checker / triage bot | Regulatory liability, requires clinical validation, high false positive risk |
| Insurance billing integration | Jurisdiction-specific, enormous payer API complexity, months of work |
| EHR/EMR integration (Epic, Cerner) | Enterprise sales cycle, HL7/FHIR complexity, not relevant for marketplace |
| Lab test booking | Separate logistics domain (sample collection, lab partnerships) |
| Multi-language / i18n | Doubles content management work, delays launch — English first |
| Native mobile apps (iOS/Android) | Doubles development surface — responsive web with PWA first |
| Real-time hardware/wearable integration | Hardware ecosystem fragmentation, requires FHIR compliance |
| Subscription / membership tiers | Complicates pricing UX — validate pay-per-consult first |
| Session recording | Regulatory complexity, storage costs, consent UX |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| DISC-01 | Phase 2 | Complete |
| DISC-02 | Phase 2 | Complete |
| DISC-03 | Phase 2 | Complete |
| APPT-01 | Phase 2 | Complete |
| APPT-02 | Phase 2 | Complete |
| CONS-01 | Phase 3 | Complete |
| CONS-02 | Phase 3 | Complete |
| CONS-03 | Phase 3 | Complete |
| PRSC-01 | Phase 4 | Complete |
| PRSC-02 | Phase 4 | Complete |
| ADMN-01 | Phase 5 | Complete |
| ADMN-02 | Phase 5 | Complete |
| ADMN-03 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 — traceability complete after roadmap creation*
