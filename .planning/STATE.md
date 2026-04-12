---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: E-Pharmacy & Payments
status: Ready to execute
stopped_at: Completed 06-03-PLAN.md
last_updated: "2026-04-12T23:13:43.004Z"
last_activity: 2026-04-12
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 5
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** A patient can discover a doctor, book an appointment, have a real-time consultation (chat → call → video escalation), receive a prescription, and buy medicines — all in one seamless flow.
**Current focus:** Phase 06 — payment-foundation

## Current Position

Phase: 06 (payment-foundation) — EXECUTING
Plan: 5 of 5

## Performance Metrics

| Metric | v1.0 Value | v2.0 Value |
|--------|------------|------------|
| Phases | 5 | 6 (planned) |
| Plans | 25 | TBD |
| LOC | ~20,200 | TBD |
| Commits | 61 | 0 (so far) |
| Phase 06 P03 | 6m | 2 tasks | 3 files |
| Phase 06 P02 | ~8m | 2 tasks | 4 files |
| Phase 06 P05 | 6m | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**v2.0 key pending decisions:**

- Payment processor: Helcim (first choice) or PaymentCloud+NMI (fallback) — must be resolved before Phase 6 planning
- LegitScript certification: must be applied for at start of Phase 6 — 12-18 week external timeline
- PaymentService abstraction: gateway-agnostic HTTP layer so processor can be swapped without changing commission/order logic
- Separate Redis for Celery: `noeviction` policy required — cannot share with WebSocket pub/sub Redis

### Architecture Notes

- New backend routers: `/pharmacy/products`, `/pharmacy/orders`, `/payments`, `/admin/payouts`
- New service classes: `PaymentService`, `CommissionLedger`, `OrderFulfillmentSvc`, `ReminderScheduler`
- New DB tables (6): `pharmacy_products`, `pharmacy_inventory_log`, `pharmacy_orders`, `pharmacy_order_items`, `payments`, `payment_ledger`
- Modified tables (2): `prescriptions` (add `dispensed_by`, `dispensed_at`), `notifications` (extend enum)
- Frontend: `(patient)/patient/pharmacy/` new section; `(pharmacist)/pharmacist/` full rewrite from stubs
- Zustand cart state (no backend cart persistence needed at v2 scale)

### Blockers/Concerns

- **Payment processor unresolved:** Helcim and PaymentCloud+NMI need AUP and API verification — validate during Phase 6 planning
- **LegitScript certification:** 12-18 week external timeline — apply at Phase 6 start; pharmacy orders can be built in sandbox but cannot go live until certification issued
- **Celery deployment:** Existing deployment does not run Celery worker or Beat process — infrastructure change required for Phase 10
- **Consultation messages encryption:** Need to verify whether `consultation_messages.content` already uses `EncryptedString` TypeDecorator before Phase 11 — plaintext content requires a migration
- **Commission rate snapshotting:** `KVStore` commission_rate is mutable; `payment_ledger` must snapshot rate at payment time, not read it at payout time

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260321-2o9 | Write Readme.md | 2026-03-20 | d3dd60b | [260321-2o9-write-readme-md](./quick/260321-2o9-write-readme-md/) |

## Session Continuity

Last activity: 2026-04-12
Stopped at: Completed 06-03-PLAN.md
Resume file: None
Next: `/gsd:plan-phase 6`
