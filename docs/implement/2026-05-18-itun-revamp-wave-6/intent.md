---
run_id: 2026-05-18-itun-revamp-wave-6
intent: |
  Wave 6 of the ITUN revamp — continues M2 (Sheet, Print & Snapshot Publishing).
  Adds click-to-edit stat fields on the sheet view, A4 + US Letter print
  stylesheets, and share-URL UX (Publish button + /s/$id read-only route)
  on top of Wave 5's read-only sheet + snapshot backend.
acceptance_criteria:
  - id: AC-1
    text: "MechSheet HP/AP/TP/SP/EP/Heat fields are inline-editable via a shared InlineEditField component. Click → input → blur/Enter persists via entityStore.update with optimistic UI + Zod validation. Esc cancels. Invalid input surfaces an error inline. Same pattern applied to pilot stat fields where applicable."
  - id: AC-2
    text: "Inline edits invoke useSoftWarnings; warnings render inline near the edited field via SoftWarningBanner."
  - id: AC-3
    text: "Print stylesheet at apps/in-the-union-now/src/styles/print.css uses @media print + @page rules to produce professional output at A4 (210x297mm) and US Letter (8.5x11in). Body ≥ 12pt, headings larger, page-breaks avoided inside cards/stats. Sheet.tsx applies the print class on print intent. A render test verifies the print classes apply (no programmatic print-quality assertion — that's maintainer-reviewed per milestones-data.md §2C)."
  - id: AC-4
    text: "Manual print-review checklist documented in the cycle record covering: open sheet → print preview on Chrome + Firefox → A4 and US Letter both legible, no clipping, sensible page breaks."
  - id: AC-5
    text: "PublishButton on Sheet calls POST /api/snapshots with the current entity JSON; success opens a ShareURLDialog showing the share URL (/s/<id>) with copy-to-clipboard. Errors surface in-dialog."
  - id: AC-6
    text: "A /s/$id route fetches via GET /api/snapshots/:id and renders the snapshot in the existing Sheet.tsx component (read-only mode). 404 shows a not-found state. bun run check:all green; PR opens against yitun-revamp referencing #199 + #200 + #201 + #205."
out_of_scope:
  - "Mobile-responsive sheet (#206), browser matrix (#207), sheet smoke beyond present tests (#208) — Wave 7."
  - "Workspace UI (#209), contextual SRD reference (#210/#211) — M3."
  - "Click-to-edit on systems/modules/equipment beyond the stat fields — that's a polish iteration; just stat numbers in this wave."
  - "Production deployment of snapshot endpoints — ADR-010 documents what's needed."
proposed_ontology_terms:
  - "InlineEditField — click-to-edit shared component for stat numbers"
  - "Print stylesheet — @media print rules producing professional A4 + US Letter output"
  - "PublishButton — sheet-view action that POSTs to the snapshot backend and surfaces the share URL"
  - "ShareURLDialog — modal with the share URL + copy-to-clipboard"
source:
  kind: prompt
  ref: "deliver invocation 2026-05-18 — Wave 6 of ITUN revamp"
---

# Intent — itun-revamp-wave-6

## Statement

Wave 6 of the ITUN revamp — continues M2. Adds click-to-edit stat fields,
A4 + US Letter print stylesheets, and the share-URL UX on top of Wave 5's
read-only sheet view + snapshot backend.

## Acceptance Criteria

- **AC-1** (#199): Inline-editable HP/AP/TP/SP/EP/Heat via shared InlineEditField; entityStore.update on save; Esc cancels; invalid input shows error.
- **AC-2** (#199): Inline edits invoke useSoftWarnings → SoftWarningBanner renders inline near edited field.
- **AC-3** (#200 + #201): print.css with @media print + @page rules; A4 + US Letter; legible typography + sensible page-breaks.
- **AC-4**: Manual print-review checklist in cycle record.
- **AC-5** (#205): PublishButton → POST /api/snapshots → ShareURLDialog with copy-to-clipboard.
- **AC-6** (#205 + ship): /s/$id route fetches + renders snapshot via Sheet.tsx; 404 state; check:all green; PR opens.

## Out of Scope

- Mobile-responsive sheet (#206), browser matrix (#207), sheet smoke tests (#208) — Wave 7.
- M3 stories.
- Click-to-edit on systems/modules/equipment beyond stat numbers — polish iteration.
- Production deployment of snapshot endpoints — ADR-010 documents the env vars.

## Ontology

- **Reused**: all prior wave terms.
- **Proposed**:
  - InlineEditField — click-to-edit stat number component
  - Print stylesheet — @media print + @page rules
  - PublishButton — sheet action that publishes a snapshot
  - ShareURLDialog — modal with share URL + copy-to-clipboard

## Source

- **kind**: prompt
- **ref**: deliver invocation 2026-05-18 — Wave 6 of ITUN revamp
- **bound issues**: #199 + #200 + #201 + #205
