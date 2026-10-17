# Chips and Actions

The law for what an entity strip or titled header shows, and where; it amends [EDL](entity-display-language.md) E17 and E18, and extends [ruleset.md](ruleset.md) §4.7 to chips.
Status: agreed. Design: [Token & Chip Grammar](https://claude.ai/artifact/KgnbEv1HTJ4sYoNxiyhffj). The goal: dense, calm strips that never shift the view.

## The strip

A strip is a Token, a Row or Card head, or a TitledBox, Slab or SheetSectionCard header.

1. **Zones** — identity (tier or number, the name) · information (chips) · actions (controls).
2. **Classes** — the chips, in one order: mark (note, User-made), rank (TL), measure (Slots, SP, HP, SV), economy (action type, RNG, DMG), traits, cost, state (a live reading, condition, quantity).
   The cost sits at the seam: read, it is the last chip; live, the Dashboard's pennant (ruleset §1.4), the first action.
3. **Budgets** — Mention: none. Token: rank, one context lane, cost, state. Row, Card, Page and Peek: every class. TitledBox and Slab: at most two summary chips, totals and caps of what they hold.
4. **Contexts** — a Token's container names one: `loadout` (Slots; a unit's SP), `play` (action type, or `ACTIONS | n`), `inventory` (quantity above 1), `roster` (the lead vital, `HP | 10/10`), `browse` (none).
   The model maps a context to a fact per kind; no component branches on schema.

## Rules

- **C1** Every strip is identity · information · actions, in that order.
- **C1a** One Size per strip: its chips and controls share one height and one centre line, Mini in a Token, Compact on a head.
- **C2** Chips keep the class order; a form drops classes, never reorders them.
- **C3** Budgets are static: no chip is added, dropped or moved by width, content or hover. What a Token leaves out, its Peek shows.
- **C4** A Token's context lane is named by its container, from the closed list.
- **C5** Only the name flexes: a Token's ends in "…", any other wraps. Chips and controls never shrink, clip or scale.
- **C6** In a list each chip class and action slot is a column every line shares; an absent value leaves its cell empty, and a lane never shrinks below its chip.
  Too narrow for every lane and a readable name (a container query), each line packs right and its empty cells collapse.
- **C7** A live reading reserves its maximum's width, in tabular figures.
- **C8** Actions live inside the entity's own strip, after the chips, in fixed slots: state · uses · ⋯ or ✕. A state's follow-up (Repair) opens from the state slot.
  At most two visible controls, then ⋯; never hover-only, never inside the chip group.
- **C9** A mode swaps what fills a slot (a read chip, a control, a seal), never its size.
- **C10** A header's summary never repeats a child's fact or its parent's summary; Slab and TitledBox take it as one `SlabCount` list.

## Built as

- **A narrow head** — a container query puts its chips beside the name or under it; the content never decides.
- **A Token with actions** — a `div` whose name cut-out is the link and the Peek trigger, so no button sits inside a link.
