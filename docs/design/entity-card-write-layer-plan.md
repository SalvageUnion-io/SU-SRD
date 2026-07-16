# Entity Card — Write-Layer Coverage Plan

**Status:** Design / plan only. No implementation in this doc.
**Read-only design:** locked as of commit `37cd4766` (the `NEW*` card system,
`packages/suref-react/src/components/referenceEntity/NEW/`).
**Companion mockups:** the write-layer _evolution_ mockups (three-way old-SRD ·
new read-only · new editable) — see the published artifact linked on PR #466.

---

## 1. Where we are

The redesigned card (`NEWReferenceEntityCard`) is a **read-only presentational
renderer**. Its whole surface is: `data`, `size` (`full`/`compact`/`listing`),
`depth`, `pattern`, `parentSeal`, `hostTone`, `chassisName`, `droneLoadout`,
`className`. It renders four bands — header (domain/tech-level tone) · sub-header
(darker shade, trait/stat cells) · body (paper inset: content, nested cards,
callouts) · footer (darkest shade: type label + source·page) — plus the unified
**tone × depth** model, folded single-actions, drone loadouts, pattern↔chassis
composition, and the crawler-bay damaged-effect callout.

It is **Ladle-only today**: not exported from the barrel, zero production
consumers. The incumbent `ReferenceEntityDisplay` (57-file folder + `DisplayCard`
frame) is what both apps actually render, and it carries an entire
**interactive/write layer** the new card does not yet implement. A straight
delete-and-rename cutover would break `suref-web` islands and every ITUN
wizard/sheet/dashboard surface.

**The plan:** evolve the read-only card up to parity with that write layer —
each affordance _layered onto the existing design, never a redesign_ — prove it
in three-way Ladle stories, then migrate consumers and retire the legacy folder.

---

## 2. Gap inventory

Priority is by ITUN consumer frequency (from the consumer grep). Each gap lists
what legacy does, and the **evolution** — how it rides on top of the locked
read-only card.

| #   | Gap                             | Legacy mechanism                                                                                                                                                                                                                     | ITUN use         | Priority |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | -------- |
| 1   | **`hide` config**               | `hide?: {actions, patterns, damagedEffect, choices, stats, content, rollTable, footer}` suppresses body/stat sections                                                                                                                | **18×**          | **P0**   |
| 2   | **Status badge + cycle**        | `status` (Intact/Damaged/Destroyed) chip beside title; `onStatusClick` cycles; `damaged` greys header; `damageOverlayText` scrim                                                                                                     | 12× / 3×         | **P0**   |
| 3   | **Selection halo + card-click** | `Sel` wrapper 3px rust halo (wizard: double ink halo); `addControl`/`navigateControl` = hidden whole-card click + hover-enlarge                                                                                                      | wizard core      | **P1**   |
| 4   | **Visible controls**            | `ControlButtons` overlay straddling top-right border: `selectControl` (black pill), `deleteControl` (rust danger pill + trash), `Buy` (primary pill)                                                                                 | selection/sheets | **P1**   |
| 5   | **Editable stats**              | `StatItem.onChange` → `StatsBar` edit mode → `ValueBox` with a vertical +/- stepper column                                                                                                                                           | sheets           | **P1**   |
| 6   | **Interactive choice cards**    | `ChoiceGroups`/`ChoiceCard`: masonry of mini-cards, Chosen/Not-Chosen rust stamp, faded-until-chosen, `FreeTextChoiceCard` input/textarea; live header data-row via `resolveChoiceView`; controlled `selections`/`onSelectionChange` | grants/bays      | **P1**   |
| 7   | **Slot overrides**              | `titleOverride`, `titleSlot`, `subtitleExtra`, `statsOverride`, `primaryStatsOnly`, `abilitiesSection`, `afterExtraContent`, `afterChoicesContent`, `footerOverride`, `rightContent`, `npcConfig`, `label`(+`labelBadge`)            | via hooks        | **P2**   |
| 8   | **Density / misc**              | `lightweight` (title+controls only header), external-link/`Buy`, GuideSteps `interactive`, `onCardClick`/`cardClickable`, `dimHeader`/`disabled`                                                                                     | scattered        | **P2**   |

---

## 3. Per-gap evolution notes

### P0 — density & status (unblocks the most ITUN surfaces)

**1. `hide` config.** Add a `hide?: NEWHideConfig` prop mirroring the legacy
keys. It only _subtracts_ already-rendered sections — the read-only card already
resolves each section (actions fold, nested groups, stats, footer, content), so
`hide` is a set of render guards, no new visuals. `size="listing"` already
implies most of these; `hide` gives the granular control ITUN's 18 sites want
(e.g. `hide={{actions:true, choices:true}}` on a wizard cell).

**2. Status.** Two coordinated pieces, both additive:

- **Status chip** — a `Badge` in the header's stat axis, right of the title:
  Intact = status-ok green `#6f8a4a`, Damaged = status-warn amber `#c07a2f`,
  Destroyed = status-bad red `#b0432b`; paper text, 22px stamp-chip. With
  `onStatusClick` it becomes a button that cycles Intact→Damaged→Destroyed.
- **Damaged/destroyed treatment** — `damaged`/`destroyed` overrides the header
  tone to grey `#969696` (keep sub-header/footer as darker greys), matching
  legacy. Optional `damageOverlayText` draws a translucent scrim + red danger box
  over the body inset. `disabled` = whole-card `opacity-50`.

  _Reuses:_ our card already has the red-tinted "WHEN DAMAGED" callout treatment
  (crawler bays) — the destroyed/overlay red is the same `status-bad` token.

### P1 — selection, controls, editable stats, choices

**3. Selection halo + whole-card click.** A `selected?` prop draws the halo as a
`box-shadow` on the card frame — 3px rust `#a85222` for standard, and the wizard
"poster" double-halo `0 0 0 3px var(--ground), 0 0 0 6px var(--color-ink)` behind
a `variant="poster"`. Non-layout-shifting (shadow, not border). `onCardClick`
(or an `addControl`/`navigateControl`-style hidden control) makes the whole card
a `role="button"` with the existing hover-enlarge (`-translate-y-0.5 scale-[1.02]`)
and focus ring. Off/disabled cells: `opacity-50 saturate-50`.

**4. Visible controls.** A `controls?: NEWControl[]` prop rendered as an overlay
straddling the top-right border (absolute, `z-30`), reusing the legacy shapes:
icon-only square (paper fill / ink border, hover-invert) and segmented label pill
(`font-mono bold uppercase`). Variants map to our tokens: primary = ink, danger =
rust, ghost = paper. `deleteControl` = rust "Delete" + trash; `selectControl` =
ink "Select"/"Selected" pill; `Buy` = primary pill → store. Clicks
`stopPropagation` so they never trigger the card click.

**5. Editable stats.** Extend the header/sub-header stat cells to an **edit
mode**: when a stat carries `onChange`, render the vertical +/- stepper column to
the right of the value box (`h-4 w-4` buttons, ink border, hover-invert, disabled
at min/max) — identical anatomy to legacy `ValueBox` edit mode. Read-only stats
are unchanged. This is the one place the sub-header/`NEWStatBox` gains an
interactive branch; the box itself is visually the same.

**6. Interactive choice cards.** Today the card shows choices as read-only
sub-header "slots" ("choose"/"roll or choose"). Add a controlled
`selections`/`onSelectionChange` pair and render the interactive `ChoiceGroups`
in the **body** (not the sub-header) when editable — the existing
`choiceCard/` primitives already produce the design language (colored header,
Chosen/Not-Chosen rust stamp, faded-until-chosen, free-text input). The header
data-row reflects selections live via `resolveChoiceView`. Read-only stays as the
static slot (or `StaticChoiceCard` bullets). Both share one `selections` state
owned by the parent — same contract as legacy.

### P2 — slot overrides & long-tail density

**7. Slot overrides.** Port the generic slot props as-is (they're the extension
seam consuming hooks depend on): `titleOverride`/`titleSlot`,
`statsOverride`/`primaryStatsOnly`, `subtitleExtra`, `abilitiesSection`,
`afterExtraContent`/`afterChoicesContent`, `footerOverride`, `rightContent`,
`npcConfig`, `label`(+`labelBadge` → the callout stamp above the frame). These
keep `useChassisPatternConfig`, `useDetailModal`, and ITUN sheet/wizard
composition working after cutover with minimal call-site churn.

**8. Density / misc.** `lightweight` (title+controls-only header), the SRD
external-link + `Buy` control folded into the footer, GuideSteps `interactive`
(step state + sticky footer action), `cardClickable`, `dimHeader`. Lowest
frequency — do last.

---

## 4. Three-way Ladle comparison

Per the review direction, each write feature gets a Ladle story showing **three
columns on one page**:

1. **Old SRD** — the legacy `ReferenceEntityDisplay` with the interactive prop
   (`selectControl`, `status`+`onStatusClick`, editable stats, `ChoiceGroups`).
2. **New read-only** — `NEWReferenceEntityCard` as it stands now.
3. **New editable** — the evolved `NEWReferenceEntityCard` with the same
   interactive prop, proving the affordance is an additive layer.

This extends the existing read-only stories (which already do old-vs-new) with
the third editable column. Real SRD entities only, per the stories convention.

---

## 5. Cutover sequencing (after parity)

1. Barrel-export the renamed canonical components; add a story per component
   (coverage guard). Preserve the shared, non-legacy files the new card already
   imports (`referenceEntityStatsConfig`, `referenceEntityHelpers`,
   `BlockContentRendererView`, `choiceCard/`, primitives).
2. Migrate read-only consumers first (`suref-web` islands, OG screenshots) — the
   lowest-risk drop-ins.
3. Migrate ITUN interactive consumers behind the ported props, surface by surface
   (dashboard → sheets → wizard → encounter), keeping tests green each step.
4. Once no import of legacy `ReferenceEntityDisplay` remains, delete the legacy
   folder + stories and drop the `NEW` prefix / `NEW/` + `Legacy/` story groups.

No production consumer changes until parity is proven in Ladle.
