---
phase: 05-admin-panel
plan: "02"
subsystem: frontend
tags: [admin, user-management, pagination, suspend, activate, auth-redirect]
dependency_graph:
  requires: ["05-01"]
  provides: ["ADMN-01"]
  affects: ["frontend/lib/api.ts", "frontend/proxy.ts"]
tech_stack:
  added: []
  patterns: [optimistic-ui, server-side-pagination, role-filter, 403-redirect]
key_files:
  created:
    - frontend/app/(auth)/suspended/page.tsx
  modified:
    - frontend/app/(admin)/admin/users/page.tsx
    - frontend/proxy.ts
    - frontend/lib/api.ts
decisions:
  - "Used plain <select> for role filter instead of shadcn Select to avoid Suspense issues"
  - "403 suspended redirect uses response.clone() so caller can still read body"
  - "Optimistic UI updates status badge and button immediately on suspend/activate success"
metrics:
  duration: "4 min"
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_modified: 4
---

# Phase 05 Plan 02: Enhanced User Management Summary

**One-liner:** Admin user management page with role filtering, server-side pagination, one-click suspend/activate, and graceful suspended-user redirect via 403 interception.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Enhance users page with role filter, pagination, suspend/activate | e625a3c | frontend/app/(admin)/admin/users/page.tsx |
| 2 | Create suspended page, update proxy PUBLIC_PATHS, add 403 redirect | 529e4e5 | frontend/app/(auth)/suspended/page.tsx, frontend/proxy.ts, frontend/lib/api.ts |

## What Was Built

### Task 1: Enhanced Users Page

Rewrote `frontend/app/(admin)/admin/users/page.tsx` with:

- **Role filter dropdown** (plain `<select>`) with options: All, Patient, Doctor, Pharmacist, Admin. Changing the filter resets page to 0.
- **Server-side pagination** with `limit=20`, `offset=page*limit`. URLSearchParams built with role param when filter is not "all".
- **User count label** that reflects the active filter (e.g., "12 Doctors" vs "47 users").
- **Suspend/Activate actions** with `actionLoading` state per user ID. Optimistic update flips `account_status` immediately on success; toast confirms. Error toast on failure.
- **Admin-role rows** render a disabled Suspend User button with `opacity-50 cursor-not-allowed` — not hidden per D-04.
- **Pagination controls**: Previous/Next buttons (disabled at boundaries) + up to 5 page number buttons (current page uses `variant="default"`, others `variant="outline"`). Only rendered when `totalPages > 1`.
- **Empty state**: "No users found" heading + "No users match the selected filter. Try selecting a different role." body.
- **Error state**: `<Alert variant="destructive">` with "Failed to load users. Please refresh."
- **Loading state**: 5x `<Skeleton className="h-14 w-full rounded-lg" />` in `space-y-3`.
- Table grid updated from 5-column to 6-column (`grid-cols-[1fr_1fr_120px_160px_140px_140px]`) with Actions column.

### Task 2: Suspended Page, Proxy Update, apiFetch 403 Handling

- **`/suspended` page** follows the exact pattern of `/pending-approval/page.tsx`: HealthConnect wordmark, Sign out button (top-right ghost), Card with Ban icon in `bg-red-50` circle, "Account suspended" heading at `text-[28px]`, body copy per UI-SPEC.
- **`frontend/proxy.ts`**: Added `"/suspended"` to `PUBLIC_PATHS` — unauthenticated users redirected to /suspended after suspension can access the page without being looped back to /login.
- **`frontend/lib/api.ts`**: Added 403 check after the 401 retry block. Clones response with `response.clone()` so the caller can still consume the body. If `body.detail.toLowerCase().includes("suspended")`, clears access token and auth session cookie, redirects to `/suspended`. Non-suspended 403 responses pass through unchanged.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Plain `<select>` for role filter | Avoids Suspense boundary requirements that shadcn Select introduces; simpler, consistent with plan instructions |
| `response.clone()` before reading 403 body | Preserves response body for caller consumption after 403 intercept check |
| Optimistic UI on suspend/activate | Immediate visual feedback; consistent with applications page pattern |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all features are fully wired to backend API endpoints defined in Plan 01.

## Self-Check

- [x] `frontend/app/(admin)/admin/users/page.tsx` — file exists and contains all required tokens
- [x] `frontend/app/(auth)/suspended/page.tsx` — file exists
- [x] `frontend/proxy.ts` — contains `/suspended`
- [x] `frontend/lib/api.ts` — contains `/suspended`, `response.clone()`, `suspended`
- [x] Commit e625a3c exists
- [x] Commit 529e4e5 exists

## Self-Check: PASSED
