---
phase: "05-admin-panel"
plan: "01"
subsystem: "backend"
tags: ["admin", "user-management", "commission", "api", "tests"]
dependency_graph:
  requires: []
  provides: ["admin-user-management-api", "admin-commission-api", "admin-stats-api"]
  affects: ["backend/app/routers/admin.py", "backend/app/core/deps.py", "backend/app/models/user.py"]
tech_stack:
  added: []
  patterns: ["Pydantic v2 response models with from_attributes", "selectinload for async ORM joins", "KVStore for commission config", "AccountStatus-based 403 guard in get_current_user"]
key_files:
  created:
    - "backend/app/schemas/admin.py"
    - "backend/alembic/versions/006_add_rejection_reason.py"
    - "backend/tests/test_admin.py"
  modified:
    - "backend/app/routers/admin.py"
    - "backend/app/models/user.py"
    - "backend/app/core/deps.py"
decisions:
  - "UserAdminPaginatedOut.users uses list[UserAdminOut] not plain list — Pydantic v2 cannot serialize ORM objects from a plain list type annotation"
  - "Suspended check in get_current_user placed before is_active check — suspended users set is_active=False, so ordering matters to return 403 not 401"
  - "DoctorProfileSummary.specialty sourced from User.specialty not DoctorProfile — specialty lives on User model not DoctorProfile"
metrics:
  duration: "8 minutes"
  completed: "2026-03-21"
  tasks: 2
  files_changed: 6
---

# Phase 05 Plan 01: Admin Backend API Summary

Admin panel backend API — pagination/filter user listing, suspend/activate accounts, doctor application review with profile data, rejection reason persistence, commission CRUD via KVStore, and platform stats endpoint.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create admin schemas, rejection_reason model field, migration 006, suspended user 403 | c4eea1b | admin.py (schemas), user.py, 006_add_rejection_reason.py, deps.py |
| 2 | Extend admin router with all endpoints, write 11 integration tests | 0ce3756 | admin.py (router), test_admin.py, schemas/admin.py (fix), deps.py (fix) |

## What Was Built

### Admin Schemas (`backend/app/schemas/admin.py`)
- `UserAdminPaginatedOut` — paginated user list with total count
- `DoctorProfileSummary` — specialty, qualifications, bio for application review
- `ApplicationAdminOut` — pending application with optional doctor_profile
- `RejectApplicationRequest` — optional rejection_reason body
- `AdminStatsOut` — platform stats (total users, by_role, pending, commission rate)
- `CommissionIn / CommissionOut` — commission rate read/write

### Admin Router (`backend/app/routers/admin.py`)
- `GET /admin/users` — paginated with `limit/offset`, optional `role` filter, returns `{users: [...], total: N}`
- `POST /admin/users/{id}/suspend` — sets suspended + is_active=False, blocks admin accounts (400)
- `POST /admin/users/{id}/activate` — sets active + is_active=True, blocks admin accounts (400)
- `GET /admin/applications` — includes doctor_profile via selectinload
- `POST /admin/applications/{id}/reject` — accepts optional rejection_reason body
- `GET /admin/stats` — total users, by_role dict, pending count, commission rate
- `GET /admin/settings/commission` — reads from kv_store
- `PUT /admin/settings/commission` — writes to kv_store

### Model & Migration
- Added `rejection_reason: Mapped[str | None]` field to `User` model
- Created migration `006_add_rejection_reason.py` (nullable VARCHAR(1000) on users table)

### Auth Fix (`backend/app/core/deps.py`)
- Added `AccountStatus.suspended` check in `get_current_user` returning HTTP 403 "Account suspended."
- Import is inside function body alongside `User` (avoids circular imports)

### Tests (`backend/tests/test_admin.py`)
11 integration tests all passing:
- `test_list_users_pagination` — pagination returns correct count/slice
- `test_list_users_role_filter` — role filter returns only matching role
- `test_suspend_user` — suspend sets account_status=suspended
- `test_activate_user` — activate sets account_status=active
- `test_cannot_suspend_admin` — admin suspension returns 400
- `test_suspended_user_blocked` — suspended user with valid JWT gets 403
- `test_list_applications_profile` — applications include doctor_profile.bio
- `test_reject_with_reason` — rejection_reason persisted to DB
- `test_get_commission` — commission GET returns float
- `test_set_commission` — commission PUT then GET round-trips correctly
- `test_admin_stats` — stats endpoint returns all required fields

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UserAdminPaginatedOut.users typed as plain list**
- **Found during:** Task 2 (first test run)
- **Issue:** `users: list` (plain Python list) causes Pydantic v2 to fail serialization of ORM User objects with `PydanticSerializationError: Unable to serialize unknown type`
- **Fix:** Changed `users: list` to `users: list[UserAdminOut]` in `UserAdminPaginatedOut`
- **Files modified:** `backend/app/schemas/admin.py`
- **Commit:** 0ce3756

**2. [Rule 1 - Bug] Suspended user check ordering causes 401 instead of 403**
- **Found during:** Task 2 (test_suspended_user_blocked)
- **Issue:** `if user is None or not user.is_active` runs before the suspended check. Since suspend sets `is_active=False`, suspended users get 401 instead of 403.
- **Fix:** Split the check: None check first, then AccountStatus.suspended (403), then is_active check (401)
- **Files modified:** `backend/app/core/deps.py`
- **Commit:** 0ce3756

**3. [Rule 1 - Deviation] DoctorProfileSummary.specialty sourced from User.specialty**
- **Found during:** Task 2 implementation
- **Issue:** Plan says DoctorProfileSummary has `specialty` field, but `specialty` lives on the `User` model not `DoctorProfile`
- **Fix:** In the `list_applications` endpoint, populate `DoctorProfileSummary.specialty` from `user.specialty`
- **Files modified:** `backend/app/routers/admin.py`
- **Commit:** 0ce3756

## Self-Check: PASSED

Files exist:
- backend/app/schemas/admin.py — FOUND
- backend/alembic/versions/006_add_rejection_reason.py — FOUND
- backend/tests/test_admin.py — FOUND
- backend/app/routers/admin.py — FOUND

Commits exist:
- c4eea1b — FOUND
- 0ce3756 — FOUND
