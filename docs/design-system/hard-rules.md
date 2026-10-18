# The Hard Rules

Each law of [ruleset.md](ruleset.md), [EDL](entity-display-language.md) and [chips-and-actions.md](chips-and-actions.md) that a machine can check, with the gate that holds it.
Status: agreed. A rule is **held** (its gate fails the build), **partial** (a gate covers some surfaces) or **planned** (the gate is named, not built).
The loop: define it here, land its gate with a baseline, burn the baseline to zero, then mark it held. Evidence: [Consistency Rulebook](https://claude.ai/artifact/4dbxMJqNv6Ti3Zwjh6jG1w).

## Coverage

- **R0 Every layout gate sees every context** — sibling heights, chip strips, nesting depth and R2, R6, R10, R12, R17 run over one route list: Reference, Listing, Peek, Live Sheet in Read and Edit, the wizards, Manage (the Hangar, the Play hub, a Game's page, the invite screen) and Play (player, Mediator, phone), at phone and page widths, signed in.
  Gate: a `designRoutes` list in `apps/web/e2e/_helpers.ts`, seeded as the gallery seeds. Partial today: Play's signed-in `sibling-heights` pass covers the player canvas and phone; chip strips and nesting depth see no Play route.

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
  Gate: planned, `data-chip-class` order check in `chip-strips.e2e.ts`; a `unitRowModel` budget unit test; a `SlabCount` unit test; no chip in a foot band.
- **R5 A linked unit is a relation chip** (C11) — the same in Read and Edit; no role stamp, no Token under a Row.
  Gate: planned, banned copy "Assigned Mech" / "Assigned Pilot"; e2e: no entity directly under another Row's head.
- **R6 Nothing beside or under a strip** (C8, E8) — state, uses and actions sit in the chip group; Details opens the Page.
  Gate: planned, e2e over R0: every control in an entity list item is inside its chip group. Play: Head's `controls` slot draws after the chip group.

## Primitives

- **R1 One section head, the solid Slab** (§3.9, §5.7) — a dashed head reads as user-made.
  Gate: planned, `Slab` takes no `variant` (the type system).
- **R7 Play draws with the shared primitives** (§0, §6.3, E15) — heads, chips, stats, gauges and stamps as on the sheet; entity markup only in `entity/`.
  Gate: planned, a lint banning `su-entity-(row|token)__` and `entity/parts` imports outside `entity/`. Play: `PlayVital` over `VitalGauge` is the model; its resolve readout and step cells are hand-built.
- **R8 One roll instrument** (§2.4, §3.4, E14) — `RollTableInstrument`, open on a Page, panel or resolve; its stamp the one roll control, a result its marked row, the same mark for every outcome.
  Gate: planned, e2e: a Page with a table shows its bands without a click. Play: `PlayRollTable` is the model; resolve, Push, Heat, Morale and NPC rolls are not yet.
- **R9 No state colour fills a button** (§3.1, §3.3) — destructive is rust behind `ConfirmDialog`.
  Gate: planned, `buttonVariants` has no `danger`; Play does not use it; `ConfirmDialog`'s danger tone remains.
- **R10 A surface sets its texture once** (§3.5.1, E13) — Play is flat.
  Gate: `tokens/texture-placement` (source, held); Play's frame sets it once (`PlayFrame.test.tsx`); planned, e2e: no `[data-grain]` inside Play.
- **R11 One Live Sheet grammar** (§0, §1.2) — pilot, mech, crawler and NPC share the shell: Read | Edit, SheetHero, full-word vitals (`bookStats`), corner actions, one remove control, one unit-out treatment; Read omits what is empty.
  Gate: planned, a per-kind e2e over the four sheets.
- **R15 One select mode** (EDL Modes) — ring and seal at level 1, ring only at level 2, one dim, one choice a radio.
  Gate: planned, a Card seal unit test; no `opacity` literal in pickers.
- **R16 One component per chrome role** (§0, §3.12) — WizShell, `Input` and `Field`'s one label, BreadcrumbTrail, `Pending`, one offline notice, `Button surface="ink"`; one verb per act (Move, Delete), Reference never SRD.
  Gate: planned, raw `<input>`/`<textarea>` outside the atoms; `aria-label="Breadcrumb"` only in BreadcrumbTrail; `aria-current="step"` only in WizShell; banned copy variants.
- **R18 Same content, same block** (E15, N5) — a rules block renders through one component in every context.
  Gate: planned, an `entity-nesting` rule: a named block's field is read by its renderer only.
- **R19 One ground signal** (§4.8) — the surface sets `data-ground` once; no `onInk`, `ground` or ink `surface` prop; paper on ink is `--color-paper-NN`.
  Gate: planned, a `styling` rule banning those props and `data-ground` outside frames; `tokens/paper-mix` (zero) for `color-mix` on paper.
- **R30 No left-rail borders** (§3.10) — colour rides in bands, stamps and gauges.
  Gate: planned, `tokens/left-rail` (zero): `border-left` / `borderLeft` / `border-inline-start` with a width.
- **R32 Dashed means user-made** (§3.9) — or a Play reference unit, an edit field, an empty slot.
  Gate: planned, `tokens/dashed` (zero): `dashed` only under the user-made, reference-unit, field and SlotGrid selectors.
- **R34 The detail view is a Page, never a new tab** (E5).
  Gate: planned, Biome `noRestrictedGlobals` on `window.open` in `apps/web/src`.
- **R36 Stats render through `Stat`** (§3.7) — never `<span>SP {n}</span>`.
  Gate: planned, a ratchet on JSX text of a stat label followed by an expression outside `Stat`.
- **R23 Icons take their Size** (§5.11) — 12, 14 or 18px from `iconSize`, stroke 2; ⋯ `Ellipsis`, close `X`, back `ChevronLeft` with the place's name.
  Gate: planned, a lint on lucide `size`/`strokeWidth` props outside `iconSize`; banned copy `←`, `‹`, `&larr;`, a text `⋯`.

## Chrome

- **R20 A notice has one job** (§8.1) — toast for an act, Banner for a condition, Message for a consequence; one `Toaster`; one offline notice; Copied is the control's own swap; no roll-tier colour.
  Gate: planned, one `<Toaster` in `apps/web/src`; offline copy in one component; the bot's tier tokens banned under `apps/web/src`.
- **R22 One loading voice** (§8.2) — `Pending`, `Skeleton` or `RoutePending`, "Loading <thing>…".
  Gate: planned, banned loading copy variants; `@keyframes` and `su-pulse` only in the loading atoms.
- **R24 Three dialog widths** (§8.3) — `ModalShell` narrow, default or page.
  Gate: planned, `ModalShell` takes `width` from the three (the type system); a `styling` rule bans `max-width` on a dialog class.
- **R27 One empty state, one error per job** (§8.4) — `EmptyState` by place, `RecoveryPanel`, `NotFoundPanel`, `toast.error`; "Try again".
  Gate: planned, banned copy ("Retry", "Failed to load", "No results found" off the searcher); a raw `role="alert"` only in the atoms.
- **R28 One focus ring** (§8.5) — `--focus-ring-shadow` on `:focus-visible`, everywhere.
  Gate: planned, `styling/focus-ring` (zero): a `:focus-visible` rule sets only the ring token.
- **R29 Tabs, Segmented, Toggle by job** (§8.6) — and no ellipsized tab label.
  Gate: planned, `role="tablist"` only in `Tabs`, `aria-pressed` groups only in `Segmented`; e2e over R0: no tab or segment label overflows.

## Measures

- **R12 One Size per line; 44px on touch; 11px at render** (§4.6, §4.7, C1a) — menu items included; no fixed row height under its controls; no text under 11px as drawn.
  Gate: partial, `sibling-heights.e2e.ts` (Starter Set sheets, Play); planned, over R0, `[role=menuitem]` in the touch floor, and a computed font-size sweep. Play's 0.62 canvas threshold is ADR-045 decision 1.
- **R13 Tokens only** (§4.1–§4.4, §4.7) — no literal tracking, control height, ink `color-mix`, border width or radius; spacing on §4.4's scale.
  Gate: planned, `tokens/raw-tracking`, `size-literal`, `ink-mix`, `raw-border-width`, `raw-radius` (zero); `raw-spacing` (ratchet).
- **R14 Caps through the stamp, Button and `capsLabel`** (§3.12, §4.2) — 11px caps are snug.
  Gate: planned, a ratchet on hand-set `uppercase`; a zero rule pairing `fontSize.badge` with `capsSnug`.
- **R17 A Page has one rhythm** (§1.7, §7.1) — the body starts under the band; 12px between level-1 blocks; the stat column's 1px frame and 14px label.
  Gate: planned, e2e on a short and a long Page.
- **R31 Value cells and seams** (§7.1, §7.2) — a value cell is paper with a 1px ink frame; a border-riding stamp centres on its line.
  Gate: planned, e2e over R0: every `Stat` cell's background and border, every seam stamp's centre within 1px of its border.
- **R33 A Peek is terminal** (§1.6, E16) — no button, link, input or nested Peek on its plate.
  Gate: planned, e2e: open a Peek per kind and find none.
- **R35 The form fits the place** (E2, E11, E19) — a list item is a Row, Tile or Token; a lead only on an SRD index; a chassis ability only on its pages, else a contentful Token.
  Gate: planned, e2e over R0.
- **R21 One breakpoint ladder** (§4.9) — 40, 48, 64, 80rem, `width >=`, media, container and JS alike; Play's phone floor the named exception.
  Gate: planned, `tokens/raw-breakpoint` (zero): a query width off the ladder, a `max-width` query or a px container query; JS reads `breakpoint`.
- **R25 Motion is tokens** (§4.10) — `--dur-fast`, `--dur-base`, `--ease`; loops only for loading, under `no-preference`.
  Gate: planned, `tokens/raw-duration` and `raw-easing` (zero); a `@keyframes` loop outside a `no-preference` block fails.
- **R26 One lift, one layer scale** (§4.4, §4.11) — `--shadow-lift`, 3px popups, z-index from `layer`.
  Gate: planned, `tokens/raw-shadow` (any `box-shadow` but the lift and the focus ring) and `raw-z-index` (a literal above 3), zero; popup radius under R13's `raw-radius`.
