# The Hard Rules

Each law of [ruleset.md](ruleset.md), [EDL](entity-display-language.md) and [chips-and-actions.md](chips-and-actions.md) that a machine can check, with the gate that holds it.
Status: agreed. A rule is **held** (its gate fails the build), **partial** (a gate covers some surfaces) or **planned** (the gate is named, not built).
The loop: define it here, land its gate with a baseline, burn the baseline to zero, then mark it held. Evidence: [Consistency Rulebook](https://claude.ai/artifact/4dbxMJqNv6Ti3Zwjh6jG1w).

## Coverage

- **R0 Every layout gate sees every context** — sibling heights, chip strips, nesting depth and R2, R6, R10, R12, R17 run over one route list: Reference, Listing, Peek, Live Sheet in Read and Edit, the wizards and Play (player, Mediator, phone), at phone and page widths, signed in.
  Gate: a `designRoutes` list in `apps/web/e2e/_helpers.ts`, seeded as the gallery seeds. Partial today: Play's signed-in `sibling-heights` pass covers the player canvas and phone; chip strips and nesting depth see no Play route.

## Strips and chips

- **R2 In a list, every chip class is a column** (C6, C7) — siblings share lane edges; an absent value leaves its cell empty; readings are tabular.
  Gate: planned, `chip-strips.e2e.ts` compares each `data-chip-class` left edge across a list wider than its pack breakpoint.
- **R3 A chip is never clipped or dropped** (C3, C5) — only the name flexes.
  Gate: planned, `_chipStrips.ts` fails a chip outside its strip's visible box.
- **R4 Every strip is `Chips`, in class order** (C2, C2a) — the Page band, Tiles and unit Rows included; budgets from the form, never a schema set.
  Gate: planned, `data-chip-class` order check in `chip-strips.e2e.ts`; a `unitRowModel` budget unit test.
- **R5 A linked unit is a relation chip** (C11) — the same in Read and Edit; no role stamp, no Token under a Row.
  Gate: planned, banned copy "Assigned Mech" / "Assigned Pilot"; e2e: no entity directly under another Row's head.
- **R6 Nothing beside or under a strip** (C8, E8) — state, uses and actions sit in the chip group; Details opens the Page.
  Gate: planned, e2e over R0: every control in an entity list item is inside its chip group. Play: Head's `controls` slot draws after the chip group.

## Primitives

- **R1 One section head, the solid Slab** (§3.9, §5.7) — a dashed head reads as user-made.
  Gate: planned, `Slab` takes no `variant` (the type system).
- **R7 Play draws with the shared primitives** (§0, §6.3, E15) — heads, chips, stats, gauges and stamps as on the sheet; entity markup only in `entity/`.
  Gate: planned, a lint banning `su-entity-(row|token)__` and `entity/parts` imports outside `entity/`. Play: `PlayVital` over `VitalGauge` is the model; its resolve readout and step cells are hand-built.
- **R8 One roll instrument** (§2.4, E14) — `RollTableInstrument`, open on a Page, panel or resolve; its stamp the one roll control, a result its marked row.
  Gate: planned, e2e: a Page with a table shows its bands without a click. Play: `PlayRollTable` is the model; resolve, Push, Heat, Morale and NPC rolls are not yet.
- **R9 No state colour fills a button** (§3.1, §3.3) — destructive is rust behind `ConfirmDialog`.
  Gate: planned, `buttonVariants` has no `danger`; Play does not use it; `ConfirmDialog`'s danger tone remains.
- **R10 A surface sets its texture once** (§3.5.1, E13) — Play is flat.
  Gate: `tokens/texture-placement` (source, held); Play's frame sets it once (`PlayFrame.test.tsx`); planned, e2e: no `[data-grain]` inside Play.
- **R11 One Live Sheet grammar** (§0, §1.2) — pilot, mech, crawler and NPC share the shell: Read | Edit, SheetHero, full-word vitals (`bookStats`), corner actions, one remove control, one unit-out treatment; Read omits what is empty.
  Gate: planned, a per-kind e2e over the four sheets.
- **R15 One select mode** (EDL Modes) — ring and seal at level 1, ring only at level 2, one dim, one choice a radio.
  Gate: planned, a Card seal unit test; no `opacity` literal in pickers.
- **R16 One component per chrome role** (§0, §3.12) — WizShell, `Input`, BreadcrumbTrail, `Pending`, one offline notice, `Button surface="ink"`; one verb per act (Move, Delete), Reference never SRD.
  Gate: planned, raw `<input>`/`<textarea>` outside the atoms; `aria-label="Breadcrumb"` only in BreadcrumbTrail; `aria-current="step"` only in WizShell; banned copy variants.
- **R18 Same content, same block** (E15, N5) — a rules block renders through one component in every context.
  Gate: planned, an `entity-nesting` rule: a named block's field is read by its renderer only.

## Measures

- **R12 One Size per line; 44px on touch** (§4.6, §4.7, C1a) — menu items included; no fixed row height under its controls.
  Gate: partial, `sibling-heights.e2e.ts` (Starter Set sheets, Play); planned, over R0, and `[role=menuitem]` in the touch floor. Play's 0.62 canvas threshold is ADR-045 decision 1.
- **R13 Tokens only** (§4.1–§4.4, §4.7) — no literal tracking, control height, ink `color-mix`, border width or radius; spacing on §4.4's scale.
  Gate: planned, `tokens/raw-tracking`, `size-literal`, `ink-mix`, `raw-border-width`, `raw-radius` (zero); `raw-spacing` (ratchet).
- **R14 Caps through the stamp, Button and `capsLabel`** (§3.12, §4.2) — 11px caps are snug.
  Gate: planned, a ratchet on hand-set `uppercase`; a zero rule pairing `fontSize.badge` with `capsSnug`.
- **R17 A Page has one rhythm** (§1.7, §7.1) — the body starts under the band; 12px between level-1 blocks; the stat column's 1px frame and 14px label.
  Gate: planned, e2e on a short and a long Page.
