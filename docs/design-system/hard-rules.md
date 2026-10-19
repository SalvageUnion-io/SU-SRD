# The Hard Rules

Each law of [ruleset.md](ruleset.md), [EDL](entity-display-language.md), [chips-and-actions.md](chips-and-actions.md) and [chrome.md](chrome.md) that a machine can check, with the gate that holds it.
Status: agreed. A rule is **held** (its gate fails the build), **partial** (a gate covers some surfaces) or **planned** (the gate is named, not built).
The loop: define it here, land its gate with a baseline, burn the baseline to zero, then mark it held. Evidence: [Consistency Rulebook](https://claude.ai/artifact/4dbxMJqNv6Ti3Zwjh6jG1w).

## Coverage

- **R0 Every layout gate sees every context** — sibling heights, chip strips, nesting depth and R2, R6, R10, R12, R29, R31, R35 run over one route list: Reference, Listing, Peek, Live Sheet in Read and Edit, the wizards, Manage (the Hangar, the Play hub, a Game's page, the invite screen) and Play (player, Mediator, phone), at phone and page widths, signed in.
  Gate: held. `designRoutes` in `apps/web/e2e/_helpers.ts`, one entry or more per route family at both widths; `e2e/__tests__/designRoutes.test.ts` fails a family with no entry or a missing width. `seedDesignAccount` (`e2e/_designRoutes.ts`) seeds as the gallery seeds, and `walkDesignRoutes` opens each view: Edit, a Peek open, every Play phone tab. Run over it: `sibling-heights.e2e.ts`, `chip-strips.e2e.ts` and `nesting-depth.e2e.ts`, each with a `BASELINE` of today's debt by route family and rule. R2, R6, R10, R12, R29, R31 and R35's e2e gates walk it too; R17 runs its own short and long Pages (`page-rhythm.e2e.ts`).

- **Held without an R-number** — these gates fail the build today:
  - `tokens/*` (`packages/gates/rules/designTokens.ts`): raw colour, gradient, shadow tokens, type floor, rust allowlist, cool ground, texture placement (§3.1, §3.5, §4.1, §4.6).
  - `tone-ground` (§3.8), `contrast.test.ts` (§3.8, §4.1), `pipRows.test.ts` (§4.5), `statOrder.test.tsx` (§2.6).
  - `entity-nesting` (N2, N3, N5) and `nesting-depth.e2e.ts` (N1, N3–N7): N1 nothing headed at level 2 or deeper; N2 only a Token is a head alone; N3 a Token nests nothing; N4 a Token fills its line; N5 no TitledBox inside an entity; N6 a wizard step is untitled around its entities; N7 select is a Row's or Card's, never a Token's (bar the in-card toggle).
  - `copy` (§3.12, a ratchet): banned variants, lowercase terms, the Scrap verb, `TL` in prose.

## Strips and chips

- **R2 In a list, every chip class is a column** (C6, C7) — siblings share lane edges; an absent value leaves its cell empty; readings are tabular.
  Gate: planned, `chip-strips.e2e.ts` compares each `data-chip-class` left edge across a list wider than its pack breakpoint.
- **R3 A chip is never clipped or dropped** (C3, C5) — only the name flexes.
  Gate: planned, `_chipStrips.ts` fails a chip outside its strip's visible box.
- **R4 Every strip is `Chips`, in class order** (C2, C2a, C10) — the Page band, Tiles and unit Rows included; budgets from the form, never a schema set; a header's summary repeats no child's fact; a foot band is text, never chips.
  Gate: held. `Chips` draws every strip (a Token's, a Row's, Card's or `Head`'s, the Page band, a Tile's, a Slab's summary), each chip in its class's lane (`data-chip-class`); `_chipStrips.ts` fails a chip in no lane (`unclassed`), a strip that goes back in the class order (`order`), a read chip after the cost (`cost`) and a chip in a `[data-foot-band]` (`foot`), over the SRD pages with no allowlist and over R0 with no baseline. `UnitRow.test.tsx` pins `unitRowModel`'s budget (a roster keeps the rank and the lead vital); `slabSummary.test.tsx` pins C10 and the two-chip summary. A Tile's budget is a compact head's in its kind's context (`budgetFacts`), no schema set.
- **R5 A linked unit is a relation chip** (C11) — the same in Read and Edit; no role stamp, no Token under a Row.
  Gate: planned, banned copy "Assigned Mech" / "Assigned Pilot"; e2e: no entity directly under another Row's head.
- **R6 Nothing beside or under a strip** (C8, E8) — state, uses and actions sit in the chip group; Details opens the Page.
  Gate: planned, e2e over R0: every control in an entity list item is inside its chip group. Play: Head's `controls` slot draws after the chip group.

## Primitives

- **R1 One section head, the solid Slab** (§3.9, §5.7) — a dashed head reads as user-made.
  Gate: held, `Slab` takes no `variant` (the type system); `chrome.test.tsx` pins the solid stamp.
- **R7 Play draws with the shared primitives** (§0, §6.3, E15) — heads, chips, stats, gauges and stamps as on the sheet; entity markup only in `entity/`.
  Gate: planned, a lint banning `su-entity-(row|token)__` and `entity/parts` imports outside `entity/`. Play: `PlayVital` over `VitalGauge` is the model; its resolve readout and step cells are hand-built.
- **R8 One roll instrument** (§2.4, §3.4, E14) — `RollTableInstrument`, open on a Page, panel or resolve; its stamp the one roll control, a result its marked row, the same mark for every outcome.
  Gate: planned, e2e: a Page with a table shows its bands without a click. Play: `PlayRollTable` is the model; resolve, Push, Heat, Morale and NPC rolls are not yet.
- **R9 No state colour fills a button** (§3.1, §3.3) — destructive is rust behind `ConfirmDialog`.
  Gate: held, `buttonVariants` has no `danger` (the type system; `Btn.test.tsx` pins it); `ConfirmDialog`'s danger tone remains, its confirm rust.
- **R10 A surface sets its texture once** (§3.5.1, E13) — only the Cockpit is flat; Manage (the Play hub, a Game's page) is paper under a band that keeps its speckle.
  Gate: held. `tokens/texture-placement` (source); Play's frame sets it once (`PlayFrame.test.tsx`); `texture.e2e.ts` over R0's Play and Manage routes: no `[data-grain]` on a Cockpit (player, solo, Mediator; canvas and every phone tab) or an overlay it opens (a Peek, a menu, the Mediator's Reference), and every Manage page's `ChapterBand` keeps its `.su-grain-layer`. No baseline.
- **R11 One Live Sheet grammar** (§0, §1.2) — pilot, mech, crawler and NPC share the shell: Read | Edit, SheetHero, full-word vitals (`bookStats`), corner actions, one remove control, one unit-out treatment; Read omits what is empty.
  Gate: planned, a per-kind e2e over the four sheets.
- **R15 One select mode** (EDL Modes) — ring and seal at level 1, ring only at level 2, one dim, one choice a radio.
  Gate: planned, a Card seal unit test; no `opacity` literal in pickers.
- **R16 One component per chrome role** (§0, §3.12) — WizShell, `Input` and `Field`'s one label, BreadcrumbTrail, `Pending`, one offline notice, the outlined `Button` (on an ink ground, its paper outline by R19); one verb per act (Move, Delete), Reference never SRD.
  Gate: planned, raw `<input>`/`<textarea>` outside the atoms; `aria-label="Breadcrumb"` only in BreadcrumbTrail; `aria-current="step"` only in WizShell; banned copy variants.
- **R18 Same content, same block** (E15, N5) — a rules block renders through one component in every context.
  Gate: planned, an `entity-nesting` rule: a named block's field is read by its renderer only.
- **R19 One ground signal** (K1) — the surface sets `data-ground` once; no `onInk`, `ground` or ink `surface` prop; paper on ink is `--color-paper-NN`.
  Gate: held, `chrome/ground-signal` (zero: those props, Stat's `inverse`, and `data-ground` outside the frames in `packages/gates/rules/chrome.ts`) and `chrome/paper-mix` (zero: a `color-mix` fading paper).
- **R30 No left-rail borders** (§3.10) — colour rides in bands, stamps and gauges.
  Gate: held, `chrome-tokens/left-rail` (zero, `packages/gates/rules/chromeTokens.ts`): `border-left` / `borderLeft` / `border-inline-start` with a width, unless its rule draws the right edge at that width (a frame) or reaches it through a sibling combinator (a divider, `a + b`).
- **R32 Dashed means user-made** (§3.9) — or a Play reference unit, an edit field, an empty slot.
  Gate: held, `chrome-tokens/dashed` (zero, `packages/gates/rules/chromeTokens.ts`): `dashed` only under the user-made, reference-unit, edit-field and empty-slot selectors (`DASHED_SELECTORS`) or files (`DASHED_FILES`), never under `:focus`.
- **R34 The detail view is a Page, never a new tab** (E5).
  Gate: held, the Biome plugin `noWindowOpen.grit` bans `window.open` in `apps/web/src` (`noRestrictedGlobals` bans a name, not a member); `useDetailModal.test.tsx` pins link mode.
- **R36 Stats render through `Stat`** (§3.7) — never `<span>SP {n}</span>`.
  Gate: planned, a ratchet on JSX text of a stat label followed by an expression outside `Stat`.
- **R23 Icons take their Size** (§5.11, K11) — 12, 14 or 18px from `iconSize`, stroke 2; ⋯ `Ellipsis`, close `X`, back `ChevronLeft` with the place's name.
  Gate: planned, a lint on lucide `size`/`strokeWidth` props outside `iconSize`; banned copy `←`, `‹`, `&larr;`, a text `⋯`.

## Chrome

- **R20 A notice has one job** (K5) — toast for an act, Banner for a condition, Message for a consequence; one `Toaster`; one offline notice; Copied is the control's own swap; no roll-tier colour.
  Gate: planned, one `<Toaster` in `apps/web/src`; offline copy in one component; the bot's tier tokens banned under `apps/web/src`.
- **R22 One loading voice** (K6) — `Pending`, `Skeleton` or `RoutePending`, "Loading <thing>…".
  Gate: planned, banned loading copy variants; `@keyframes` and `su-pulse` only in the loading atoms.
- **R24 Three dialog widths** (K7) — `ModalShell` narrow, default or page.
  Gate: planned, `ModalShell` takes `width` from the three (the type system); a `styling` rule bans `max-width` on a dialog class.
- **R27 One empty state, one error per job** (K8) — `EmptyState` by place, `RecoveryPanel`, `NotFoundPanel`, `toast.error`; "Try again".
  Gate: planned, banned copy ("Retry", "Failed to load", "No results found" off the searcher); a raw `role="alert"` only in the atoms.
- **R28 One focus ring** (K9) — `--focus-ring-shadow` on `:focus-visible`, everywhere.
  Gate: held, `chrome/focus-ring` (zero): a rule on a focused subject (`:focus-visible`, `:focus-within`, a `:has()` of one) sets only `--focus-ring-shadow` and the forced-colors transparent outline; a `:focus` rule paints no indicator of its own. `focusRing.contrast.test.ts` holds the ring at 3:1 on every ground, Play's included.
- **R29 Tabs, Segmented, Toggle by job** (K10) — and no ellipsized tab label.
  Gate: planned, `role="tablist"` only in `Tabs`, `aria-pressed` groups only in `Segmented`; e2e over R0: no tab or segment label overflows.

## Measures

- **R12 One Size per line; 44px on touch; 11px at render** (§4.6, §4.7, C1a) — menu items included; no fixed row height under its controls; no text under 11px as drawn.
  Gate: partial, `sibling-heights.e2e.ts` (Starter Set sheets, Play); planned, over R0, `[role=menuitem]` in the touch floor, and a computed font-size sweep. Play's 0.62 canvas threshold is ADR-045 decision 1.
- **R13 Tokens only** (§4.1–§4.4, §4.7) — no literal tracking, control height, ink `color-mix`, border width or radius; spacing on §4.4's scale.
  Gate: partial, `tokens/raw-tracking`, `size-literal`, `ink-mix`, `raw-border-width`, `raw-radius` held (zero); `raw-spacing` a ratchet at 54 (`tools/baselines/rule-sets.json`), every one off §4.4's scale, so a layout move; held when it reaches zero, before 4.0.0.
- **R14 Caps through the stamp, Button and `capsLabel`** (§3.12, §4.2) — 11px caps are snug.
  Gate: planned, a ratchet on hand-set `uppercase`; a zero rule pairing `fontSize.badge` with `capsSnug`.
- **R17 A Page has one rhythm** (§1.7, §7.1) — the body starts under the band; 12px between level-1 blocks; the stat column's 1px frame and 14px label.
  Gate: held, `page-rhythm.e2e.ts` (`_pageRhythm.ts`) on short and long SRD Pages and the app's detail Page at page and phone widths: the first block within 24px of the band, each block (a level-1 frame, Token list, Slab, the art, stats, opening, prose and table) 12px under the nearest above it, every stat value framed 1px, every stat label 14px. Planned: the class and guide pages (their own layouts), and level-1 cards from `entity/` (`PatternLinkRow`, the class page's `PathCard`).
- **R31 Value cells and seams** (§7.1, §7.2) — a value cell is paper with a 1px ink frame; a border-riding stamp centres on its line.
  Gate: held. `value-cells.e2e.ts` (`_valueCells.ts`) over R0: every `Stat` value plate is paper (or transparent on paper), its cell framed 1px solid on every side in ink (a paper rule on an ink ground, the state colour under `good`, `caution`, `critical`); every `STAMP_SEAM` stamp centres within 1px of its frame's top border line. It reads 1,371 value cells and 8 seam stamps and fails if it reads none. No baseline.
- **R33 A Peek is terminal** (§1.6, E16) — no button, link, input or nested Peek on its plate.
  Gate: held. `peek-terminal.e2e.ts` opens a Peek of every kind (23: each entity schema the Union bar's search Peeks, plus the Mentions, Tags and roll Tokens on SRD pages and a Starter Set sheet: `actions`, `crawler-bays/npc`, `crawler-bays/table`) and finds on its plate no button, `a[href]`, field, `role="button"`/`"link"` or tab stop, no `[data-peek]`, and no chip that draws the pointer; a kind that stops Peeking fails it (`KINDS`). The `Token`, `Mention` and `PeekCard` unit tests stay.
- **R35 The form fits the place** (E2, E11, E19) — a list item is a Row, Tile or Token; a lead only on an SRD index; a chassis ability only on its pages, else a contentful Token.
  Gate: held, `form-fits.e2e.ts` (`_formFits.ts`) over R0: a list item's outermost entity is a Row, Tile or Token (never a Card, a hand-built frame or a bare sheet link); a `Lead` only on an SRD index, never on a Peek's plate; a chassis ability (`chassis.json`'s names) at level 1 only on a chassis or pattern Page and the mech sheet's hero, else a contentful Token. Its `BASELINE`: a chassis Page's pattern rows (`PatternLinkRow`), hand-built and leading with the pattern's description.
- **R21 One breakpoint ladder** (K2) — 40, 48, 64, 80rem, `width >=`, media, container and JS alike; Play's phone floor the named exception.
  Gate: held, `chrome-tokens/raw-breakpoint` (zero, `packages/gates/rules/chromeTokens.ts`): a query width off the ladder, a `max-width` (or `<`) query, any px query, or a script's literal width (it reads `breakpoint` / `widthAtLeast`); a complement is `not (width >= …)`. Two component fits stay off the ladder on a waived line each: the stat column's cell counts and a Row's art by room (E10).
- **R25 Motion is tokens** (K3) — `--dur-fast`, `--dur-base`, `--ease`; loops only for loading, under `no-preference`.
  Gate: held, `chrome-tokens/raw-duration` and `raw-easing` (zero, `packages/gates/rules/chromeTokens.ts`): a literal duration, an easing named at the call site or none named (the browser's default); `chrome-tokens/motion-loop` (zero): an `infinite` animation outside a `no-preference` block, or in a style object. A loading loop's period is `--dur-loop`.
- **R26 One lift, one layer scale** (§4.4, K4) — `--shadow-lift`, 3px popups, z-index from `layer`.
  Gate: held, `tokens/raw-shadow` (any `box-shadow` that casts, a blur, but `--shadow-lift`; the focus ring is `--focus-ring-shadow`, and a spread-only ring or inset frame casts nothing) and `raw-z-index` (a literal above 3), zero; popup radius under R13's `raw-radius`.
