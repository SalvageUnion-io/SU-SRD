# Plan — itun-revamp-wave-6

Three cycles, file-disjoint by directory.

## Cycle-1 (Track A): Click-to-edit stat fields (#199)

- **ACs**: AC-1, AC-2
- **Branch**: `run/2026-05-18-itun-revamp-wave-6/cycle-1`
- **Files**:
  - `apps/in-the-union-now/src/components/sheet/InlineEditField.tsx` (NEW)
  - `apps/in-the-union-now/src/components/sheet/EditableStatRow.tsx` (NEW)
  - `apps/in-the-union-now/src/components/sheet/MechSheet.tsx` (EDIT — wire HP/AP/TP/SP/EP/Heat as editable; small additions only)
  - `apps/in-the-union-now/src/components/sheet/PilotSheet.tsx` (EDIT — wire pilot stat numbers if applicable)
  - `apps/in-the-union-now/src/components/sheet/__tests__/InlineEditField.test.tsx` (NEW)
  - `apps/in-the-union-now/src/components/sheet/__tests__/EditableStatRow.test.tsx` (NEW)

## Cycle-2 (Track B): Print stylesheets (#200 + #201)

- **ACs**: AC-3, AC-4
- **Branch**: `run/2026-05-18-itun-revamp-wave-6/cycle-2`
- **Files**:
  - `apps/in-the-union-now/src/styles/print.css` (NEW)
  - `apps/in-the-union-now/src/index.css` (EDIT — `@import './styles/print.css'` line)
  - `apps/in-the-union-now/src/components/sheet/Sheet.tsx` (EDIT — apply print-mode wrapper class on print intent)
  - `apps/in-the-union-now/src/components/sheet/__tests__/print.test.tsx` (NEW — render test verifying print classes apply)
  - Cycle record documents manual review checklist for Chrome + Firefox

## Cycle-3 (Track C): Share-URL UX (#205)

- **ACs**: AC-5, AC-6
- **Branch**: `run/2026-05-18-itun-revamp-wave-6/cycle-3`
- **Files**:
  - `apps/in-the-union-now/src/components/sheet/PublishButton.tsx` (NEW)
  - `apps/in-the-union-now/src/components/sheet/ShareURLDialog.tsx` (NEW)
  - `apps/in-the-union-now/src/lib/snapshot/client.ts` (NEW — typed fetch wrapper for publish + retrieve)
  - `apps/in-the-union-now/src/routes/s/$id.tsx` (NEW — read-only snapshot route)
  - `apps/in-the-union-now/src/components/sheet/Sheet.tsx` (EDIT — add PublishButton in header; small)
  - `apps/in-the-union-now/src/components/sheet/__tests__/PublishButton.test.tsx` (NEW)
  - `apps/in-the-union-now/src/routes/__tests__/snapshot-route.test.tsx` (NEW)

## Dep graph

All three independent. Sheet.tsx is touched by cycle-1 (small edit) AND cycle-2 (print class wrapper) AND cycle-3 (PublishButton add). Three-way edit on Sheet.tsx — expect merge conflict at integrate; resolve by hand-merge or by letting the latest cycle absorb the others' changes.

**Pre-allocation:** cycle-3 takes responsibility for Sheet.tsx edits (it's the smallest set: PublishButton in header). Cycle-1 modifies MechSheet/PilotSheet only. Cycle-2 modifies index.css (NOT Sheet.tsx) and emits the print-mode class via a tag-level hook (or via a CSS class on the route's root element, which cycle-3 can wire if needed).

Refined: Cycle-2 does NOT touch Sheet.tsx. The print stylesheet uses `@media print` rules that apply by default to all elements; no JS-driven class toggling needed in Wave 6. Manual review is the verification path.

This makes the cycles fully file-disjoint at the Sheet.tsx level.

## File overlap (post-refinement)

| Path | Owner |
|------|-------|
| `src/components/sheet/InlineEditField.tsx`, `EditableStatRow.tsx` | Cycle-1 |
| `src/components/sheet/MechSheet.tsx`, `PilotSheet.tsx` | Cycle-1 (small edits) |
| `src/styles/print.css` | Cycle-2 |
| `src/index.css` | Cycle-2 (one import line) |
| `src/components/sheet/PublishButton.tsx`, `ShareURLDialog.tsx` | Cycle-3 |
| `src/components/sheet/Sheet.tsx` | Cycle-3 (add PublishButton in header) |
| `src/lib/snapshot/client.ts` | Cycle-3 |
| `src/routes/s/$id.tsx` | Cycle-3 |
| `src/routeTree.gen.ts` | Auto-regen; cycle-3 owns the route addition |

## Aggregate budget

- 3 cycles planned, ≤7 remediation (budget 10)
- pr_strategy: one
