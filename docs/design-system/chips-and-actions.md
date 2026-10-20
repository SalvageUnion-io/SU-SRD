# Chips and Actions

The law for what an entity strip or titled header shows, and where; it amends [EDL](entity-display-language.md) E17 and E18, and extends [ruleset.md](ruleset.md) §4.7 to chips.
Status: agreed. Design: [Token & Chip Grammar](https://claude.ai/artifact/KgnbEv1HTJ4sYoNxiyhffj). The goal: dense, calm strips that never shift the view.

## The strip

A strip is a Token, a Row or Card head, or a TitledBox or Slab header.

1. **Zones** — identity (tier or number, the name) · information (chips, the actions last among them).
2. **Classes** — the read chips, in one order: mark (note, HOMEBREW), rank (TL), measure (in the stat order, ruleset §2.6: Slots, SV, SP or HP), economy (action type, RNG, DMG), traits, relation (what it is built on or linked to: `CHASSIS | Mule`, `PILOT | Bonesaw`, `CRAWLER | #430`, `GAME | Rust Run`), cost.
   Then the slots (C8): state (a live reading, condition, quantity), uses, ⋯ or ✕.
   The cost sits at the seam: the last read chip, read or live; in Play the action is the Token's Use (ruleset §1.4).
3. **Budgets** — Mention: none. Token: rank, one context lane, cost, state; its relations are its Peek's.
   Compact Card or Row (and a contentful Token): rank, the context lane, the economy (action type, facets), traits, relations, cost, state; other measures are the full card's.
   Full Card, Page and Peek: every class (in a Peek, relation and action chips are inert, ruleset §1.6). TitledBox and Slab: at most two summary chips, totals and caps of what they hold.
4. **Contexts** — a Token's or compact head's container names one (else its kind's own: gear `loadout`, a thing you do `play`, an actor `roster`): `loadout` (Slots; a unit's SP), `play` (action type, or `ACTIONS | n`), `inventory` (quantity above 1), `roster` (the lead vital, `HP | 10/10`), `browse` (none).
   The model maps a context to a fact per kind; no component branches on schema.

## Rules

- **C1** Every strip is identity, then its chips, the actions inlined last (C8); nothing beside it.
- **C1a** One Size per strip: its chips and controls share one height and one centre line, Mini in a Token, Compact on a head.
- **C2** Chips keep the class order; a form drops classes, never reorders them. No read chip follows the cost (`_chipStrips.ts`).
- **C2a** Every strip, the Page band included, is drawn by `Chips`; each chip names its class (`data-chip-class`).
- **C2b** The bottom-right fill (owner, 2026-10-20): wherever a name and its chips or controls share a line (a Row's, Card's or Tile's head, a Page's chapter band and its controls), the chips start at the bottom right, on the name's line, the last of them (the cost, else the last slot or the page's action) in the corner. They fill that line right to left, and rise to a line above only when they overfill it; each line above fills from the right too. So the cost is always on the name's line, and a chip never rises while it fits beside the name. One flow, measured once (`components/atoms/chipFill.ts`); `_chipStrips.ts` fails a head that breaks it. On a phone an index band's search is the one control on a line of its own, on top.
- **C3** Budgets are static: no chip is added, dropped, moved or clipped by width, content or hover; a strip never hides its overflow. What a Token leaves out, its Peek shows. The one exception is C5's +MORE.
- **C4** A Token's context lane is named by its container, from the closed list.
- **C5** Only the name flexes: a Token's ends in "…", any other wraps. Chips and controls never shrink, clip or scale.
  A Token's chips are one row; a compact Card's or Row's may take two, never more. A contentful Token's may take two; past that its second line ends in a +MORE chip (no count) that opens its Peek.
- **C6** In a list of Rows each chip class and action slot is a column every line shares (a Token's chips pack right, no lanes); an absent value leaves its cell empty, and a lane never shrinks below its chip.
  Too narrow for every lane and a readable name (a container query), each line packs right and its empty cells collapse.
- **C7** A live reading reserves its maximum's width, in tabular figures.
- **C8** Actions are chips: inlined in the chip group after the cost, at its Size, in fixed slots: state · uses · ⋯ or ✕. Nothing sits beside a strip, and nothing expands under it: Details opens the Page.
  A state's follow-up (Repair) opens from the state slot; at most two visible, then ⋯; never hover-only.
- **C9** A mode swaps what fills a slot (a read chip, a control, a seal), never its size.
- **C10** A header's summary never repeats a child's fact or its parent's summary; Slab and TitledBox take it as one `SlabCount` list.
- **C11** A related unit or entity is a relation chip, label first, its value Peeking and opening it (a Game, which has no Peek, links to its Play page): never a loose stamp ("Assigned: X") or a Token beside the strip. Read and Edit show the same chip. An absent relation leaves its lane empty (C6), never an "Unassigned" chip.

## Built as

- **A narrow head** — the bottom-right fill (C2b) keeps the cost beside the name and lifts what does not fit above it; the name wraps only when not even the cost fits beside its one line.
- **A Token with actions** — a `div` whose name cut-out is the link and the Peek trigger, so no button sits inside a link.
