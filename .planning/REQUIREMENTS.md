# Requirements: HealthConnect

**Defined:** 2026-03-21
**Core Value:** A patient can discover a doctor, book an appointment, have a real-time consultation (chat → call → video escalation), receive a prescription, and buy medicines — all in one seamless flow.

## v2.0 Requirements

Requirements for e-pharmacy, payments, pharmacist dashboard, consultation history, and appointment notifications.

### E-Pharmacy: Prescription-Linked Ordering

- [ ] **RXORD-01**: Patient can initiate medicine order from completed consultation with prescription
- [ ] **RXORD-02**: Order cart is pre-filled with drug name, quantity, and dosage from prescription
- [ ] **RXORD-03**: Patient can track order status (received → verified → dispatched → delivered)
- [ ] **RXORD-04**: Prescription enforces single-use (state machine: issued → ordered → dispensed)

### E-Pharmacy: OTC Store

- [ ] **OTC-01**: Patient can browse OTC medicines by category
- [ ] **OTC-02**: Patient can search medicines by name
- [ ] **OTC-03**: Patient can view medicine detail page (name, description, dosage, price, stock)
- [ ] **OTC-04**: Patient can add to cart, adjust quantity, and checkout with payment

### Platform Payments

- [x] **PAY-01**: Patient pays for consultation at booking
- [x] **PAY-02**: Patient pays for medicine orders at checkout
- [x] **PAY-03**: Platform deducts commission and credits net amount to doctor/pharmacist
- [x] **PAY-04**: Doctor and pharmacist can view earnings dashboard (earned, commission, payouts)
- [x] **PAY-05**: Patient receives receipt/invoice for consultations and medicine orders

### Pharmacist Dashboard

- [ ] **PHARM-01**: Pharmacist can view incoming prescription order queue with attached Rx details
- [ ] **PHARM-02**: Pharmacist can manage medicine inventory (list, stock counts, add/deduct, low-stock alerts)
- [ ] **PHARM-03**: Pharmacist can progress order through fulfillment stages (verified → preparing → dispatched → delivered)
- [ ] **PHARM-04**: Pharmacist can reject order with reason (notification sent to patient)

### Consultation History

- [ ] **HIST-01**: Patient and doctor can view list of all past consultations
- [ ] **HIST-02**: Patient and doctor can view per-consultation chat transcript (read-only)

### Appointment Notifications

- [ ] **NOTIF-01**: Patient and doctor receive booking confirmation notification
- [ ] **NOTIF-02**: Patient receives reminders 24h and 1h before appointment
- [ ] **NOTIF-03**: Patient and doctor receive cancellation/reschedule notifications

### Admin

- [x] **ADMIN-01**: Admin can view all transactions with commission totals

## Future Requirements

Deferred to v3+. Tracked but not in current roadmap.

### Deferred

- **CHAT-01**: Pharmacist can chat with patient about order clarifications
- **SEARCH-01**: Full-text search across consultation transcripts
- **EXPORT-01**: PDF export of consultation summary
- **SMS-01**: SMS appointment reminders (requires TCPA opt-in consent)
- **INS-01**: Insurance/HSA billing integration
- **MULTI-01**: Multi-pharmacy routing (nearest pharmacy selection)
- **CTRL-01**: Controlled substance (Schedule II-V) ordering (requires DEA registration)
- **AI-01**: AI transcript summarization

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time delivery tracking (GPS) | Requires last-mile logistics integration; out of scope for digital platform |
| Automated prescription refills | Clinical decision risk without licensed oversight |
| Stripe/PayPal/Square payment processing | AUP explicitly prohibits telemedicine and online pharmacy |
| Controlled substance ordering | Ryan Haight Act requires prior in-person evaluation + DEA registration |
| SMS reminders | TCPA consent requirement adds UX complexity; email + in-app first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PAY-01 | Phase 6: Payment Foundation | Complete |
| PAY-02 | Phase 6: Payment Foundation | Complete |
| PAY-03 | Phase 6: Payment Foundation | Complete |
| PAY-04 | Phase 6: Payment Foundation | Complete |
| PAY-05 | Phase 6: Payment Foundation | Complete |
| ADMIN-01 | Phase 6: Payment Foundation | Complete |
| RXORD-01 | Phase 7: Prescription-Linked Ordering | Pending |
| RXORD-02 | Phase 7: Prescription-Linked Ordering | Pending |
| RXORD-03 | Phase 7: Prescription-Linked Ordering | Pending |
| RXORD-04 | Phase 7: Prescription-Linked Ordering | Pending |
| PHARM-01 | Phase 7: Prescription-Linked Ordering | Pending |
| PHARM-03 | Phase 7: Prescription-Linked Ordering | Pending |
| PHARM-04 | Phase 7: Prescription-Linked Ordering | Pending |
| PHARM-02 | Phase 8: Pharmacist Inventory | Pending |
| OTC-01 | Phase 9: OTC Medicine Store | Pending |
| OTC-02 | Phase 9: OTC Medicine Store | Pending |
| OTC-03 | Phase 9: OTC Medicine Store | Pending |
| OTC-04 | Phase 9: OTC Medicine Store | Pending |
| NOTIF-01 | Phase 10: Appointment Notifications | Pending |
| NOTIF-02 | Phase 10: Appointment Notifications | Pending |
| NOTIF-03 | Phase 10: Appointment Notifications | Pending |
| HIST-01 | Phase 11: Consultation History | Pending |
| HIST-02 | Phase 11: Consultation History | Pending |

**Coverage:**
- v2.0 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 — traceability populated after v2.0 roadmap creation*
