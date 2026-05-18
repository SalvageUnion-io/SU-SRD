# Cycle-1 Record — Click-to-edit stat fields (AC-1, AC-2)

**Run:** 2026-05-18-itun-revamp-wave-6
**Branch:** `run/2026-05-18-itun-revamp-wave-6/cycle-1`
**ACs covered:** AC-1, AC-2
**Status:** complete

---

## Artifacts written

| Path | Status |
|------|--------|
| `apps/in-the-union-now/src/components/sheet/InlineEditField.tsx` | NEW |
| `apps/in-the-union-now/src/components/sheet/EditableStatRow.tsx` | NEW |
| `apps/in-the-union-now/src/components/sheet/__tests__/InlineEditField.test.tsx` | NEW |
| `apps/in-the-union-now/src/components/sheet/__tests__/EditableStatRow.test.tsx` | NEW |
| `apps/in-the-union-now/src/components/sheet/MechSheet.tsx` | EDIT |
| `apps/in-the-union-now/src/lib/schemas/mech.ts` | EDIT |

---

## Schema changes

`MechSchema` (Wave 6 extension) — added 6 optional numeric fields for live-play stat tracking:

- `currentHP` — current hull/structure points
- `currentAP` — current action points
- `currentTP` — current tech points
- `currentSP` — current structure points
- `currentEP` — current energy points
- `currentHeat` — current heat level

All are `z.number().int().min(0).optional()`. The schema is still `.strict()`. IndexedDB stores schemaless JSON so no migration is needed. When absent, `MechSheet` falls back to chassis defaults.

---

## InlineEditField — design decisions

- Click → `<input>` with current value; Enter/blur → `onSave`; Esc → cancel (no save).
- Validation for `type="number"`: rejects empty string (since `Number('') = 0` is technically finite but semantically invalid) and out-of-range values.
- Red border + `role="alert"` inline error on invalid input; stays in edit mode.
- `readOnly` prop disables click affordance entirely (no `role="button"`, no handler).
- Pure controlled component — parent value prop drives display; `onSave` drives mutation.

---

## EditableStatRow — design decisions

- Composes `InlineEditField` with `useSoftWarnings` + `SoftWarningBanner`.
- Save flow: persist immediately via `storeState.update` → then `preview()` the patch for soft warnings. Warnings are advisory — the save has already happened by the time the banner appears.
- "Save anyway" calls `saveAnyway()` (re-persists the pending patch from the hook); "Fix it" clears warnings without further action.
- `store` and `evaluate` are injectable for test isolation — no `mock.module()` needed.

---

## MechSheet wire-in

Replaced `StatBlock` read-only display for HP/AP/TP/SP/EP/Heat with `EditableStatRow`. Each field:
- Falls back to chassis default when `currentXxx` is not set on the mech.
- Uses `min={0}` (no negative stats).
- `store` prop is forwarded from `MechSheet` so tests can inject a stub.

---

## PilotSheet — skip decision

The `Pilot` schema has no numeric stat fields (no HP, AP, TP, level, etc. in the current Wave 1-5 schema). `PilotSheet` renders only string/array data. No editable stat rows apply. This is documented as out-of-scope for Wave 6 cycle-1 — if pilot stats are added to `PilotSchema` in a future wave, the same `EditableStatRow` pattern applies trivially.

---

## Test results

- `InlineEditField.test.tsx`: 15/15 pass
- `EditableStatRow.test.tsx`: 5/5 pass
- All 287 ITUN tests pass, 0 fail
- Typecheck: clean (pre-existing `vite/client` and `salvageunion-reference` build errors in baseline are unrelated to cycle-1)

---

## Manual print-review checklist

N/A — print stylesheets are cycle-2 scope.

---

## Watchlist notes

- **Race condition**: `onBlur` and `onKeyDown(Enter)` can both fire (e.g., Enter key blurs the input in some environments). Current implementation: Enter calls `commit` then switches to display mode; subsequent blur fires but `editing=false` so `commit` is not called from blur handler. In practice, happy-dom testing showed no double-save issue. This is safe.
- **Stale closures**: `commit` closes over `draft` in the keyDown handler — this is correct because `draft` is the current React state, not a stale capture.
