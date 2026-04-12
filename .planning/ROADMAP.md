# Roadmap: HealthConnect

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-03-21)
- 🔄 **v2.0 E-Pharmacy & Payments** — Phases 6-11 (active)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-03-21</summary>

- [x] Phase 1: Foundation (6/6 plans) — completed 2026-03-20
- [x] Phase 2: Doctor Discovery and Appointments (5/5 plans) — completed 2026-03-20
- [x] Phase 3: Real-Time Consultation (7/7 plans) — completed 2026-03-20
- [x] Phase 4: Prescriptions (4/4 plans) — completed 2026-03-20
- [x] Phase 5: Admin Panel (3/3 plans) — completed 2026-03-21

</details>

### v2.0 E-Pharmacy & Payments

- [ ] **Phase 6: Payment Foundation** — Payment collection, commission splitting, earnings dashboards, and admin transaction ledger
- [ ] **Phase 7: Prescription-Linked Ordering** — Patient orders medicines from consultation Rx; pharmacist receives, verifies, and fulfills the order
- [ ] **Phase 8: Pharmacist Inventory** — Pharmacist manages the medicine catalog and stock counts that enable browsable OTC listings
- [ ] **Phase 9: OTC Medicine Store** — Patient browses, searches, and buys medicines without a prescription
- [ ] **Phase 10: Appointment Notifications** — Booking confirmations, 24h/1h reminders, and cancellation/reschedule alerts via Celery
- [ ] **Phase 11: Consultation History** — Patient and doctor view past consultation list and per-consultation chat transcript

## Phase Details

### Phase 6: Payment Foundation
**Goal**: The platform can collect payments, deduct commission, and credit net earnings to providers — before any commerce feature goes live
**Depends on**: Phase 5 (existing commission KVStore and admin panel)
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, ADMIN-01
**Success Criteria** (what must be TRUE):
  1. Patient is charged the consultation fee at the moment of appointment booking and receives a receipt
  2. Patient is charged for a medicine order at checkout and receives an itemized invoice
  3. Platform commission is automatically deducted and the net amount is recorded to the doctor or pharmacist ledger
  4. Doctor and pharmacist can view an earnings dashboard showing gross earned, commission deducted, and net payable
  5. Admin can view a paginated transaction list with per-transaction commission amounts and running totals
**Plans:** 5 plans
Plans:
- [x] 06-01-PLAN.md — Payment models, migration, PaymentService, schemas, and test scaffold
- [x] 06-02-PLAN.md — Appointment booking payment integration and receipt endpoint
- [x] 06-03-PLAN.md — Pharmacy order stub, invoice endpoint, and admin transactions endpoint
- [ ] 06-04-PLAN.md — Frontend booking payment CTA and appointment detail with receipt
- [ ] 06-05-PLAN.md — Frontend earnings dashboard and admin transactions page

### Phase 7: Prescription-Linked Ordering
**Goal**: Patient can order the exact medicines on a completed consultation prescription, and the pharmacist can verify and fulfill that order through a queue
**Depends on**: Phase 6 (payment collection at checkout)
**Requirements**: RXORD-01, RXORD-02, RXORD-03, RXORD-04, PHARM-01, PHARM-03, PHARM-04
**Success Criteria** (what must be TRUE):
  1. Patient sees an "Order Prescribed Medicines" action on a completed consultation; the cart is pre-filled with drug name, quantity, and dosage from the prescription
  2. A prescription can only be ordered once — attempting to re-order a used prescription shows a clear error
  3. Patient can track their order status through received, verified, dispatched, and delivered stages
  4. Pharmacist sees all incoming prescription orders in a queue with the attached Rx details visible
  5. Pharmacist can advance an order through fulfillment stages or reject it with a reason, and the patient is notified of rejection
**Plans**: TBD

### Phase 8: Pharmacist Inventory
**Goal**: Pharmacist has a functional inventory system so that medicine stock exists for the OTC store to surface to patients
**Depends on**: Phase 7 (PharmacyProduct model and pharmacy order infrastructure from Rx ordering)
**Requirements**: PHARM-02
**Success Criteria** (what must be TRUE):
  1. Pharmacist can add new medicines to inventory with name, category, description, dosage, price, and stock count
  2. Pharmacist can adjust stock counts (add or deduct) and the updated quantity is immediately reflected
  3. Pharmacist sees a low-stock alert indicator on medicines that fall below the threshold
**Plans**: TBD

### Phase 9: OTC Medicine Store
**Goal**: Patient can browse, search, and purchase medicines without a prescription through a self-service store
**Depends on**: Phase 6 (payment at checkout), Phase 8 (medicine inventory populated by pharmacist)
**Requirements**: OTC-01, OTC-02, OTC-03, OTC-04
**Success Criteria** (what must be TRUE):
  1. Patient can browse medicines filtered by category and sees only in-stock, non-prescription-required items
  2. Patient can search medicines by name and see matching results with price and stock status
  3. Patient can view a medicine detail page showing name, description, dosage, price, and current stock
  4. Patient can add medicines to cart, adjust quantities, complete checkout with payment, and receive an order confirmation
**Plans**: TBD

### Phase 10: Appointment Notifications
**Goal**: Patient and doctor receive timely automated notifications for booking events and appointment reminders without manual intervention
**Depends on**: Phase 6 (booking payment triggers confirmation), Phase 7 (order rejection notification pattern)
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03
**Success Criteria** (what must be TRUE):
  1. Patient and doctor each receive a booking confirmation notification immediately after an appointment is booked
  2. Patient receives an in-app and email reminder 24 hours before the appointment and another 1 hour before
  3. Patient and doctor both receive a notification when an appointment is cancelled or rescheduled
  4. Reminders are not sent for appointments that have already been cancelled (no phantom reminders)
**Plans**: TBD

### Phase 11: Consultation History
**Goal**: Patient and doctor can review all past consultations and read the full chat transcript from any session
**Depends on**: Phase 7 (prescription linkable from consultation detail)
**Requirements**: HIST-01, HIST-02
**Success Criteria** (what must be TRUE):
  1. Patient can view a paginated list of all past consultations sorted by date, showing doctor name, date, and status
  2. Doctor can view a paginated list of all past consultations sorted by date, showing patient name, date, and status
  3. Patient and doctor can open any past consultation and read the full chat transcript in read-only mode
  4. The linked prescription (if any) is visible from the consultation detail page
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 6/6 | Complete | 2026-03-20 |
| 2. Doctor Discovery and Appointments | v1.0 | 5/5 | Complete | 2026-03-20 |
| 3. Real-Time Consultation | v1.0 | 7/7 | Complete | 2026-03-20 |
| 4. Prescriptions | v1.0 | 4/4 | Complete | 2026-03-20 |
| 5. Admin Panel | v1.0 | 3/3 | Complete | 2026-03-21 |
| 6. Payment Foundation | v2.0 | 0/5 | Planned | - |
| 7. Prescription-Linked Ordering | v2.0 | 0/? | Not started | - |
| 8. Pharmacist Inventory | v2.0 | 0/? | Not started | - |
| 9. OTC Medicine Store | v2.0 | 0/? | Not started | - |
| 10. Appointment Notifications | v2.0 | 0/? | Not started | - |
| 11. Consultation History | v2.0 | 0/? | Not started | - |
