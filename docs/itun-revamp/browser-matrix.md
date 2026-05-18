# Browser matrix verification — ITUN revamp

For the M3 release gate. Maintainer runs this checklist before deploying yitun-revamp to canonical URL.

## Supported browsers

| Browser | Min version | Channel |
|---------|-------------|---------|
| Chrome  | 120+        | Stable  |
| Firefox | 120+        | Stable  |
| Safari  | 16+         | Stable  |
| Edge    | 120+        | Stable  |

## Critical flows to verify (per browser × per OS where relevant)

### Flow 1: Dashboard load + entity creation
- Cold load /
- Create a pilot via wizard
- Verify it appears on dashboard
- Repeat for mech + crawler

### Flow 2: Sheet rendering (all 4 composition modes)
- pilot-only sheet
- mech-only sheet
- crawler-only sheet
- wired (pilot + mech) sheet
- Verify stand-in renders when expected

### Flow 3: Click-to-edit
- Edit HP on MechSheet → save → reload page → value persists

### Flow 4: Snapshot publish + retrieve
- Click Publish → ShareURLDialog appears
- Copy URL → open in incognito → sheet renders read-only

### Flow 5: Service worker / offline
- Load app; disconnect network; reload → app shell loads from cache
- IndexedDB data still readable offline

### Flow 6: Print preview
- Open sheet → print preview
- Verify A4 + US Letter both render cleanly

## Known platform gotchas

### Safari
- IndexedDB: clears all data on browser restart in Private Browsing mode (expected; doc warning in app first-run)
- Service Worker: older Safari versions have aggressive eviction; min Safari 16 mitigates
- iOS Safari: 100vh ≠ actual viewport (bottom bar); use `min-h-dvh` not `min-h-screen` (already applied in Wave 0)

### Firefox
- Service Worker: stricter caching policies in private windows (expected)

### Chrome / Edge (Chromium)
- Generally most permissive; least likely to surface issues

### iOS specific
- Touch targets MUST be ≥44px (Apple HIG); Wave 7 cycle-1 covers this
- Tap delays should be <300ms (no manual fix needed; React 19 handles)

## Maintainer pass/fail checklist

| Flow | Chrome | Firefox | Safari ≥16 | Edge | Notes |
|------|--------|---------|------------|------|-------|
| 1 — Dashboard + create | [ ] | [ ] | [ ] | [ ] | |
| 2 — Sheet 4 modes | [ ] | [ ] | [ ] | [ ] | |
| 3 — Click-to-edit | [ ] | [ ] | [ ] | [ ] | |
| 4 — Snapshot publish | [ ] | [ ] | [ ] | [ ] | |
| 5 — Offline / SW | [ ] | [ ] | [ ] | [ ] | |
| 6 — Print preview | [ ] | [ ] | [ ] | [ ] | |

## Sign-off

Maintainer dates each row when verified. All rows must pass before M3 release gate.
