---
phase: 03-real-time-consultation
plan: "03"
subsystem: frontend-hooks
tags: [typescript, websocket, webrtc, hooks, notifications, real-time]
dependency_graph:
  requires: ["03-01"]
  provides: ["frontend/types/consultation.ts", "frontend/hooks/useConsultationSocket.ts", "frontend/hooks/useWebRTC.ts", "frontend/hooks/useCallTimer.ts", "frontend/lib/notifications.ts"]
  affects: ["03-04"]
tech_stack:
  added: []
  patterns: ["perfect-negotiation-webrtc", "discriminated-union-types", "auto-reconnect-websocket", "browser-notifications"]
key_files:
  created:
    - frontend/types/consultation.ts
    - frontend/hooks/useConsultationSocket.ts
    - frontend/hooks/useWebRTC.ts
    - frontend/hooks/useCallTimer.ts
    - frontend/lib/notifications.ts
  modified: []
decisions:
  - "useRef typed with explicit undefined initial value to satisfy TypeScript strict mode: useRef<ReturnType<typeof setTimeout> | undefined>(undefined)"
  - "isPolite = role === 'patient' — patient rolls back on offer collision, doctor wins as impolite peer per MDN perfect negotiation"
  - "Audio chime path hardcoded to /sounds/message-chime.mp3 — asset must be placed in public/sounds/ during UI plan"
metrics:
  duration: "~10 min"
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_created: 5
  files_modified: 0
---

# Phase 03 Plan 03: Frontend Real-Time Hooks Summary

**One-liner:** WebSocket auto-reconnect hook with token refresh, MDN perfect-negotiation WebRTC hook with doctor/patient roles, 30-minute countdown timer, and browser notification utility — all TypeScript-strict with "use client" directive.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | TypeScript types + useConsultationSocket + notification utility | de694c4 | frontend/types/consultation.ts, frontend/hooks/useConsultationSocket.ts, frontend/lib/notifications.ts |
| 2 | useWebRTC (perfect negotiation) + useCallTimer | 5be6662 | frontend/hooks/useWebRTC.ts, frontend/hooks/useCallTimer.ts |

## What Was Built

### frontend/types/consultation.ts
Discriminated union `WsEnvelope` covering all 15 WebSocket message variants (14 message types + error). REST response interfaces `ConsultationResponse` and `MessageResponse`. Connection state types `ConnectionStatus`, `CallState`, and `CallMedia`.

### frontend/hooks/useConsultationSocket.ts
WebSocket lifecycle hook with auto-reconnect (max 10 attempts, 3-second delay). Before each connect/reconnect attempt, refreshes the access token via `POST /auth/refresh` if the in-memory token is null. Returns `{ sendMessage, disconnect, status }`.

### frontend/lib/notifications.ts
Browser Notification API wrapper. `requestNotificationPermission` handles the permission request flow. `notifyNewMessage` only fires when the tab is not focused, using the `consultation-message` tag to replace stale notifications and playing a soft audio chime.

### frontend/hooks/useWebRTC.ts
Implements the MDN perfect negotiation pattern. Doctor role is "impolite" (wins offer collisions), patient is "polite" (rolls back). Supports audio-only calls with escalation to video via `addTrack` (no new RTCPeerConnection). Returns 14 properties/functions for full call control.

### frontend/hooks/useCallTimer.ts
30-minute countdown with `isWarning` flag at 5 minutes and `extend()` adding 15 minutes. `formatTime()` utility converts seconds to `MM:SS` string. Start/stop control.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed useRef strict TypeScript type error**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `useRef<ReturnType<typeof setTimeout>>()` with no initial value fails TypeScript strict mode (`Expected 1 arguments, but got 0`)
- **Fix:** Changed to `useRef<ReturnType<typeof setTimeout> | undefined>(undefined)` in both useConsultationSocket and useCallTimer
- **Files modified:** frontend/hooks/useConsultationSocket.ts, frontend/hooks/useCallTimer.ts
- **Commit:** de694c4, 5be6662

**2. [Rule 2 - Missing critical] Suppressed unused isSettingRemoteAnswerPending ref**
- **Found during:** Task 2
- **Issue:** `isSettingRemoteAnswerPending` ref declared in plan but never referenced in the handler logic (perfect negotiation rollback was simplified to ignoreOffer pattern)
- **Fix:** Added `void isSettingRemoteAnswerPending` to prevent unused variable lint error without removing the ref (it may be needed for full rollback implementation in future)
- **Files modified:** frontend/hooks/useWebRTC.ts
- **Commit:** 5be6662

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (de694c4, 5be6662) confirmed in git log.
