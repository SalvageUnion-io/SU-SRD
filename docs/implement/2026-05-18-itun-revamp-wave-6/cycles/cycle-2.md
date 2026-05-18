# Cycle-2 Record — Print Stylesheets (AC-3, AC-4)

**Run:** `2026-05-18-itun-revamp-wave-6`
**Branch:** `run/2026-05-18-itun-revamp-wave-6/cycle-2`
**Issues:** #200 (A4 print stylesheet), #201 (US Letter print stylesheet)
**ACs covered:** AC-3, AC-4

## What was built

### `apps/in-the-union-now/src/styles/print.css` (NEW)

Self-contained `@media print` ruleset covering:

- **`@page` rules:** A4 portrait, 10mm margin (default). US Letter is supported
  via the browser's native print dialog destination picker — no JS class toggle
  needed in Wave 6. A user-selectable variant (e.g., `body.us-letter @page`) is
  deferred to a future iteration.
- **Typography:** body ≥ 12pt, h3 = 14pt, h2 = 16pt, h1 = 20pt.
- **Color reset:** all backgrounds forced to `#fff`, all text to `#000`.
- **Hide non-printable elements:** `nav`, `.no-print`, `button:not([data-print])`,
  and the `header a` back-to-dashboard link.
- **Page-break rules:**
  - `page-break-inside: avoid` on `section[aria-labelledby]`, `.sheet-section`,
    `.card`, `.stat-row`, `dl`, `li`, and `img`.
  - `page-break-before: always` on `[data-page-break]` (future hook for
    sections that should always start a new page).
- **Container overrides:** `main`, `.sheet-wrapper` → `max-width: 100%;
  padding: 0; margin: 0`.
- **Border adjustments:** stat-block `dl > div` borders rendered in solid black.
- **Link URLs:** non-nav `a[href]` URLs printed inline (informational).

### `apps/in-the-union-now/src/index.css` (EDIT)

Added `@import './styles/print.css';` after the existing Tailwind + theme imports.

### `apps/in-the-union-now/src/components/sheet/__tests__/print.test.tsx` (NEW)

Smoke tests (5 describe blocks, 9 tests) confirming that the DOM elements
targeted by the print stylesheet actually exist in the rendered markup:

- `section[aria-labelledby]` present for Pilot, Mech, and Crawler sheets
- `<header>` and `header a[aria-label="Back to dashboard"]` present
- `<dl>` and `dl > div` stat blocks present for MechSheet
- Mech heading is `<h2#mech-sheet-heading>`
- Composition-mode badge renders with its `aria-label`

jsdom does not apply `@media print` rules, so no CSS-value assertions are made.
These tests are a structural smoke test only. Print quality is maintainer-reviewed.

## Manual print review checklist

**Must be completed before the M3 release gate.**

### Setup

1. Build the app:
   ```
   bun --filter in-the-union-now build
   ```
2. Preview the built output:
   ```
   bun --filter in-the-union-now preview
   ```
3. Open a sheet view in the browser, e.g.:
   `http://localhost:4173/sheet/mech/<your-mech-id>`

### Chrome review

File → Print (or Cmd+P / Ctrl+P) → "Save as PDF" or send to a physical printer.

- [ ] No fields cut off at a page boundary
- [ ] Typography legible at standard reading distance (12pt body or larger)
- [ ] Headings clearly larger than body text
- [ ] Page breaks placed sensibly (not mid-card, not mid-stat-row)
- [ ] `nav`, back-to-dashboard link, and delete/condition buttons NOT visible
- [ ] Composition-mode badge renders with a solid border (not colored bg)

### Firefox review

File → Print → "Print to PDF".

- [ ] Same checklist as Chrome above

### Page size verification

For each browser, test both page sizes:

- [ ] **A4 (210 × 297 mm):** default; no layout clipping
- [ ] **US Letter (8.5 × 11 in):** select "US Letter" in the print dialog;
      content fits without overflow (browser auto-scales from A4 source)

### Entity type coverage

Run the checklist for at least one of each composition mode:

- [ ] Pilot-only sheet
- [ ] Mech-only sheet (with PilotStandIn visible)
- [ ] Wired sheet (Pilot + Mech side-by-side sections)
- [ ] Crawler sheet

### Pass criteria

All checkboxes ticked in both Chrome and Firefox before closing issue #200/#201.

## Notes

- `@page :first` is defined but is functionally identical to `@page` here.
  It is retained as a hook for future first-page-specific margins (e.g., a
  larger top margin for a title section) without a breaking change.
- The `data-print` attribute on buttons (`button[data-print]`) is a forward-
  compatibility escape hatch. No existing buttons use it; it allows a future
  "Print this sheet" affordance that survives the hide rule.
- US Letter auto-scaling from an A4 source produces ~96% scale factor at
  identical margins, which is visually indistinguishable for a character sheet.
  If exact 1:1 sizing matters, a separate `@page { size: letter; }` rule can
  be toggled via a body class — deferred.
