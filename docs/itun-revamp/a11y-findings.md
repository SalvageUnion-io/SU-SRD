# ITUN a11y findings

Per PRD REQ-NF-10 (WCAG 2.1 AAA on sheet view) + REQ-NF-11 (AA elsewhere). Maintainer-run audit per `ideate/milestones-data.md` §3C.

## Audit approach

The repo already ships `tools/a11y-scan.ts` (puppeteer + axe-core) for `suref-web`. For ITUN, the gate is:

- **`/sheet/*` routes** — WCAG 2.1 AAA
- **All other ITUN routes** (dashboard, builders, detail views) — WCAG 2.1 AA

### Recommended a11y scan extension (deferred follow-up)

Extending `tools/a11y-scan.ts` to scan ITUN routes is a non-trivial integration (requires entity seeding to render sheet routes meaningfully). Deferred to a follow-up issue. Current Wave 9 ships:

- Manual review checklist below
- Targeted fixes for the most-likely AAA-critical (contrast, focus) + AA-critical (labels) gaps
- Documented severity policy

## Severity policy (PRD §7.0 R-5)

- **AAA-CRITICAL on `/sheet/*`** — contrast < 7:1 on text, focus invisible, focus traps, keyboard-inaccessible interactive. Brand-color overrides applied on sheet view only.
- **AA-CRITICAL elsewhere** — contrast < 4.5:1, missing labels, missing aria-describedby on errors.
- **AAA-noncritical** — cosmetic findings (line-height ratios, repeating-block landmarks) deferred to a polish pass.

## Manual review checklist (gate)

Run before any M3 release deployment.

### Sheet routes (`/sheet/pilot/*`, `/sheet/mech/*`, `/sheet/crawler/*`)

- [ ] Open with screen reader (VoiceOver on macOS, NVDA on Windows). Verify entity name announces; section headings announce.
- [ ] Tab through all interactive elements. Verify focus visible at every stop. No focus trap.
- [ ] Run axe-core via DevTools Lighthouse pane → Accessibility — verify zero contrast issues at AAA tolerance (7:1 normal, 4.5:1 large).
- [ ] aria-live regions on stat updates (HP changes announce).
- [ ] All buttons keyboard-activatable (Enter + Space).

### Builder routes (`/pilots/new`, `/mechs/new`, `/crawlers/new`)

- [ ] Every input has a programmatic label (axe-core "form-field-multiple-labels" passes).
- [ ] Error messages associated via `aria-describedby`.
- [ ] Focus order matches visual order (Tab traverses left-to-right, top-to-bottom).
- [ ] All interactive elements keyboard-reachable.

### Dashboard (`/`)

- [ ] All buttons have accessible names (axe-core "button-name" passes).
- [ ] Workspace switcher keyboard-operable.
- [ ] Delete confirmation dialog focus-trapped while open; focus restored on close.

## Known AA/AAA gaps to verify on maintainer pass

These are likely problem spots based on existing component patterns; the maintainer scan should specifically check them:

1. **InlineEditField click affordance** — when in display state, may not be obvious to keyboard users that it's interactive. Verify Tab focuses it + Enter activates edit mode.
2. **ConditionToggle** — tri-state aria announcement (Wave 3 baseline). Verify aria-pressed or role=radiogroup semantics.
3. **PublishButton** — color contrast against the sheet background may fall below 7:1.
4. **SoftWarningBanner** — `role="alert"` + `aria-live="polite"` confirmed in Wave 4 cycle-3; verify it doesn't double-announce.
5. **Dashboard EntityListItem** — delete button accessible name when icon-only.

## Sign-off

Maintainer dates each row when verified. All checklist items pass before M3 release gate.
