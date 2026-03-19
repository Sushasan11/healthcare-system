# Feature Research

**Domain:** Healthcare / Telemedicine Marketplace (multi-sided: patients, doctors, pharmacists, admins)
**Researched:** 2026-03-19
**Confidence:** HIGH (multiple sources: competitor analysis, industry reports, official documentation)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

#### Patient-Facing

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| User registration and profile | No platform works without identity | LOW | Email/phone, basic health info, photo |
| Doctor search and filtering | Core discovery — without it no bookings happen | MEDIUM | Filter by specialty, availability, ratings, location |
| Doctor profile pages | Patients need to vet before booking (77% read reviews before choosing a doctor) | LOW | Qualifications, specialties, ratings, reviews, fee |
| Appointment booking | Core transactional action of the platform | MEDIUM | Calendar view, slot selection, confirmation email/SMS |
| Consultation (chat) | Text-first consultation is now expected baseline | HIGH | Real-time WebSocket; must be HIPAA-compliant |
| Consultation (audio/video) | Video call is expected for clinical consultations | HIGH | WebRTC; requires fallback handling for poor connections |
| Consultation history | Patients revisit past conversations for follow-up | MEDIUM | Archived transcripts, timestamps, attached files |
| Digital prescription receipt | Patients expect to receive prescription electronically after consult | MEDIUM | PDF generation, linked to consultation record |
| Notifications (email/in-app) | Appointment reminders reduce no-shows; required for trust | LOW | Booking confirmation, reminders, prescription ready |
| Payment processing | Required to complete consultation purchase | MEDIUM | Stripe or equivalent; PCI-compliant, HIPAA-aware |
| Patient medical history | Continuity of care requires accessible records | MEDIUM | Consultation history, uploaded documents, prescriptions |
| OTC medicine browse and purchase | Patients expect online pharmacy browsing | MEDIUM | Product catalog, search, cart, checkout |
| Prescription-linked medicine ordering | Patients expect to fill prescriptions without leaving platform | HIGH | Links prescription to pharmacy order; requires pharmacist fulfillment loop |

#### Doctor-Facing

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Doctor profile and credential management | Doctors need to present qualifications to attract patients | LOW | Specialties, bio, fee, availability settings |
| Availability and schedule management | Without this, booking system cannot function | MEDIUM | Block/unblock time slots, working hours, calendar sync |
| Appointment dashboard | Doctors need to see upcoming and pending appointments | LOW | List/calendar view, patient info preview |
| Consultation interface (chat + audio/video) | Must match patient-side capabilities | HIGH | Same WebSocket/WebRTC session as patient |
| Patient medical history access during consult | Doctors need context; standard of care | MEDIUM | Read access to patient's past consults and prescriptions |
| Digital prescription writing | Core clinical output of a consultation | MEDIUM | Structured form (drug, dosage, duration, instructions); auto-linked to patient |
| Earnings and payout dashboard | Doctors need to track income from platform | MEDIUM | Per-consultation fees, payout schedule, commission deduction shown |

#### Pharmacist-Facing

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Prescription queue | Pharmacists need to see incoming orders linked to prescriptions | MEDIUM | Filterable by status: pending, fulfilled, dispatched |
| Inventory management | Cannot fulfill orders without tracking stock | MEDIUM | Add/edit/remove products, stock levels, low-stock alerts |
| Order management | Order lifecycle from receipt to dispatch | MEDIUM | Status updates visible to patient |
| OTC product catalog management | Pharmacist manages what appears in the store | LOW | CRUD for products, pricing, images |

#### Admin-Facing

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| User management | Platform oversight requires ability to manage all roles | MEDIUM | View/suspend/verify doctors, patients, pharmacists |
| Doctor verification workflow | Credential verification is regulatory and trust requirement | MEDIUM | Approve/reject doctor applications; document review |
| Commission configuration | Revenue model requires configurable percentages | LOW | Set commission rates per consultation category and medicine sales |
| Platform analytics dashboard | Admins need to monitor health of marketplace | MEDIUM | Total consultations, revenue, active users, pending verifications |
| Dispute and support management | Complaints and refunds are unavoidable at scale | MEDIUM | Flag consultations, issue refunds, communicate with users |

---

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required on day one, but create meaningful competitive separation.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Chat-first escalation model (chat → audio → video) | Reduces bandwidth friction; lets doctors triage by text before escalating — more efficient than forcing video immediately | HIGH | Core architectural differentiator already in PROJECT.md; most platforms default to video-first |
| Dual pharmacy model (prescription-linked + OTC) | One-stop care: consult, prescribe, buy — no leaving the platform | HIGH | Rare combination; most platforms stop at prescription generation |
| Real-time consultation status visibility | Patient sees "doctor is typing", queue position, estimated wait — reduces anxiety and abandonment | MEDIUM | WebSocket presence events; similar to chat apps |
| Doctor specialty search with real-time availability | Patients see only doctors currently available for that day — reduces booking friction | MEDIUM | Filtered slot aggregation; most competitors show all doctors regardless of availability |
| Post-consultation follow-up messaging | Patients can message the same doctor within a consultation window without rebooking | MEDIUM | Reduces unnecessary repeat bookings; increases patient satisfaction |
| Verified review system (post-consultation only) | Reviews are locked to completed consultations — prevents fake reviews | LOW | Platform-controlled; more trustworthy than open review sites |
| Doctor earnings transparency | Doctors see exact commission split per consultation — reduces churn and builds provider trust | LOW | Simple UI addition with large impact on provider acquisition |
| Prescription auto-route to linked pharmacy | Prescription auto-populates into pharmacy order queue — patient just confirms and pays | MEDIUM | Closes the loop between consult and purchase seamlessly |
| Consultation session recording (opt-in) | Patients can review what was discussed — valuable for chronic care patients | MEDIUM | Requires explicit consent flow; store encrypted; HIPAA-sensitive |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem obviously good but create disproportionate complexity, regulatory risk, or scope creep.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| AI symptom checker / triage bot | Seems modern and helpful; reduces doctor load | Regulatory liability; requires clinical validation; high false positive/negative risk; distracts from core value | Build good specialty search and "describe your issue" free-text field instead |
| Insurance billing integration | Patients expect insurance to cover visits | Jurisdiction-specific, payer API complexity is enormous, requires clearinghouse relationships; months of work for partial coverage | Accept direct payment; add insurance as a v2+ feature after validating demand |
| EHR/EMR integration (Epic, Cerner) | Clinicians want records in their existing system | Enterprise sales cycle, HL7/FHIR complexity, different integration per hospital system; not relevant for marketplace doctors | Build internal medical history that is exportable as PDF |
| Lab test booking | Logical extension of consultation flow | Separate logistics domain (sample collection, lab partnerships, result turnaround); pulls team away from core | Keep out of scope; add redirect link to external lab booking service |
| Multi-language / i18n from day one | Healthcare reaches diverse populations | Doubles content management work; delays launch without adding core validation | English-first; add language support after product-market fit |
| Native mobile apps (iOS/Android) | Mobile-first healthcare is real | Doubles development surface; PWA or responsive web reaches 90% of mobile users for a marketplace; adds app store review delays | Responsive web with PWA manifest; native apps after revenue justifies investment |
| Real-time hardware/wearable data integration | RPM (remote patient monitoring) is growing | Hardware ecosystem fragmentation (Apple Health, Fitbit, Garmin all different APIs); requires FHIR compliance for clinical use | Defer; focus on consultation quality first |
| Subscription plan / membership tiers | Recurring revenue is attractive | Complicates pricing UX; requires separate subscription billing logic; patients on marketplace don't expect subscriptions | Pay-per-consultation is clearer; add subscription for high-frequency use cases later |
| Live queue / walk-in consultations | Reduces friction for urgent care | Unpredictable doctor availability; requires online presence management; creates abandonment if doctors are unavailable | Appointment booking with same-day slots covers urgency without live queue complexity |

---

## Feature Dependencies

```
User Registration / Auth
    └──required by──> All patient, doctor, pharmacist, admin features

Doctor Profile
    └──required by──> Doctor Search & Filtering
                          └──required by──> Appointment Booking

Appointment Booking
    └──required by──> Consultation Session (chat/audio/video)
                          └──required by──> Digital Prescription Writing
                                                └──required by──> Prescription-Linked Medicine Ordering
                                                                      └──required by──> Pharmacist Order Management

Payment Processing
    └──required by──> Appointment Booking (consultation fee)
    └──required by──> Medicine Order Checkout (OTC + prescription)
    └──required by──> Doctor Earnings / Payout Dashboard

Doctor Availability Management
    └──required by──> Appointment Booking
    └──required by──> Doctor Search (real-time slot filtering)

Inventory Management (Pharmacist)
    └──required by──> OTC Store (product catalog)
    └──required by──> Prescription Order Fulfillment

Admin User Management
    └──required by──> Doctor Verification Workflow
    └──required by──> Platform Analytics

Chat-First Consultation
    └──enhances──> Audio/Video Escalation (escalation depends on chat session existing)

Doctor Profile Ratings
    └──enhances──> Doctor Search (quality signal for ranking)
    └──depends on──> Consultation Completion (reviews only after verified consult)

Prescription-Linked Ordering
    └──conflicts with──> OTC Store (separate checkout flows; must not conflate prescription and OTC orders)
```

### Dependency Notes

- **Consultation depends on Appointment Booking:** A walk-in or direct-connect model would remove this dependency, but the project uses scheduled appointments — so booking is a hard prerequisite for consultation.
- **Prescription depends on Consultation:** Prescriptions are only written within a concluded consultation session. The prescription form is not available standalone.
- **Prescription-linked ordering depends on both Prescription and Pharmacy Inventory:** The order cannot be placed if the prescribed medicine is out of stock — pharmacist inventory data must be live.
- **Payment gating on Booking:** Consultation slot should only be confirmed after payment is collected or pre-authorized. Implement payment before finalizing booking flow.
- **Doctor Verification before Listings:** A doctor profile must pass admin verification before appearing in search results. Admin verification workflow must be built before doctor public listings go live.
- **Chat and Video are separate WebSocket/WebRTC sessions but share the same consultation room ID** — they must be designed as a single session object that can carry both channel types.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to prove the end-to-end flow works (patient discovers doctor → books → consults → receives prescription → buys medicine).

- [ ] User auth (patient, doctor, pharmacist, admin roles) — identity is prerequisite for everything
- [ ] Doctor profiles with specialty, qualifications, rating display, and fee — enables discovery
- [ ] Doctor search and filtering (specialty, availability) — patients can't book without finding a doctor
- [ ] Appointment booking with payment (Stripe) — core transactional event
- [ ] Real-time chat consultation (WebSocket) — minimum consultation channel
- [ ] Audio/video escalation (WebRTC) — required for clinical adequacy; chat alone is not sufficient for diagnosis
- [ ] Digital prescription generation by doctor — closes the consultation-to-pharmacy loop
- [ ] OTC medicine store (browse, cart, checkout) — standalone revenue stream
- [ ] Prescription-linked medicine ordering — the differentiated full-circle flow
- [ ] Pharmacist dashboard (queue, inventory, fulfillment) — enables prescription orders to be completed
- [ ] Admin panel (user management, doctor verification, commission settings) — platform control
- [ ] Patient consultation history and prescription records — continuity of care; patients expect this

### Add After Validation (v1.x)

Features to add once core flow is working and real users are on the platform.

- [ ] Post-consultation follow-up messaging — add when doctors request it or patient re-booking rates are high
- [ ] Real-time consultation status / typing indicators — add when session experience complaints surface
- [ ] Prescription auto-route to pharmacy — add when prescription → order drop-off is measured as a problem
- [ ] Doctor earnings transparency dashboard (detailed breakdown) — add when doctor churn increases
- [ ] Verified review system enforcement — add when first fake review reports come in
- [ ] Email/SMS notifications (reminders, prescription ready) — add immediately after launch to reduce no-shows

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Session recording (opt-in) — defer; regulatory complexity, storage costs, consent UX
- [ ] Mobile native apps — defer; responsive web first; build native when mobile traffic justifies it
- [ ] Insurance billing — defer; requires payer relationships and jurisdiction-specific work
- [ ] Lab test booking — defer; separate logistics domain
- [ ] AI symptom triage — defer; liability risk before clinical processes are mature
- [ ] Subscription / membership tiers — defer; validate pay-per-consult demand first

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| User auth and role management | HIGH | LOW | P1 |
| Doctor profile pages | HIGH | LOW | P1 |
| Doctor search and filtering | HIGH | MEDIUM | P1 |
| Appointment booking with payment | HIGH | MEDIUM | P1 |
| Chat consultation (WebSocket) | HIGH | HIGH | P1 |
| Audio/video consultation (WebRTC) | HIGH | HIGH | P1 |
| Digital prescription writing | HIGH | MEDIUM | P1 |
| Prescription-linked pharmacy ordering | HIGH | HIGH | P1 |
| OTC medicine store | MEDIUM | MEDIUM | P1 |
| Pharmacist dashboard | MEDIUM | MEDIUM | P1 |
| Admin panel (user mgmt + verification) | HIGH | MEDIUM | P1 |
| Patient consultation history | MEDIUM | LOW | P1 |
| Notifications (email/in-app) | MEDIUM | LOW | P2 |
| Real-time consultation status indicators | MEDIUM | MEDIUM | P2 |
| Prescription auto-route to pharmacy | HIGH | MEDIUM | P2 |
| Doctor earnings transparency | MEDIUM | LOW | P2 |
| Verified post-consultation reviews | HIGH | MEDIUM | P2 |
| Post-consultation follow-up messaging | MEDIUM | MEDIUM | P2 |
| Session recording (opt-in) | LOW | HIGH | P3 |
| Subscription tiers | LOW | HIGH | P3 |
| Insurance billing | MEDIUM | HIGH | P3 |
| AI symptom checker | LOW | HIGH | P3 |
| Native mobile apps | HIGH | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Teladoc | HealthTap | ZocDoc | Our Approach |
|---------|---------|-----------|--------|--------------|
| Doctor discovery | Specialty + availability filters | AI-assisted specialty matching | Location + specialty + insurance | Specialty + availability + ratings; no insurance dependency |
| Consultation channels | Video primary | Text, phone, video | Video primary | Chat-first with escalation to audio/video — reduces bandwidth friction |
| Prescription | Yes, electronic | Yes, via platform | Provider-dependent | Yes, digital; auto-linked to pharmacy order |
| E-pharmacy integration | No (external pharmacy) | No (external pharmacy) | No | Yes — full integrated dual-model (prescription + OTC) |
| Review system | Post-visit stars | N/A | Verified post-visit | Verified post-consultation only (no anonymous reviews) |
| Payment model | Subscription + per-visit | Subscription + per-visit | Pay-per-visit + insurance | Platform commission on consultation + medicine sales |
| Pharmacist role | None | None | None | Full pharmacist dashboard — differentiating feature |

---

## Sources

- Empeek: Must-Have Telemedicine App Features — https://empeek.com/insights/telemedicine-features/
- Neklo: Full Guide for Telemedicine App Development (2025) — https://neklo.com/blog/telemedicine-app-development
- SpaceO Technologies: Telemedicine App Development 2025 — https://www.spaceotechnologies.com/blog/how-to-develop-telemedicine-app/
- Healthline: Best Telemedicine Companies 2026 — https://www.healthline.com/health/best-telemedicine-companies
- xBytes: Telemedicine App Development 2026: Features, Tech Stack, Cost — https://www.xbytesolutions.com/telemedicine-app-development-guide/
- TATEEDA: E-Prescription Software Development Guide — https://tateeda.com/blog/e-prescription-software-development-the-complete-guide
- Fortune Business Insights: Telemedicine Market Report — https://www.fortunebusinessinsights.com/industry-reports/telemedicine-market-101067
- Rater8: Best Sites for Doctor Reviews 2025 — https://rater8.com/blog/top-doctor-review-sites/
- Folio3 Digital Health: Payment Gateways for Telemedicine 2025 — https://digitalhealth.folio3.com/blog/online-payment-gateways-for-telemedicine-portal/
- Webkorps: AI in Telemedicine 2026 — https://www.webkorps.com/blog/ai-in-telemedicine/

---

*Feature research for: Healthcare / Telemedicine Marketplace*
*Researched: 2026-03-19*
