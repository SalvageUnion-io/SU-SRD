# Chips and Actions

The law for what an entity strip or titled header shows, and where; it amends [EDL](entity-display-language.md) E17 and E18, and extends [ruleset.md](ruleset.md) §4.7 to chips.
Status: agreed. Design: [Mini & Chip Grammar](https://claude.ai/artifact/KgnbEv1HTJ4sYoNxiyhffj). The goal: dense, calm strips that never shift the view.

## The strip

A strip is a Mini, a Compact or Full head, or a TitledBox or Slab header.

1. **Zones** — identity (tier or number, the name) · information (chips, the actions last among them).
2. **Classes** — the read chips, in one order: mark (note, HOMEBREW), rank (TL), measure (in the stat order, ruleset §2.6: Slots, SV, SP or HP), economy (action type, RNG, DMG), traits, relation (what it is built on or linked to: `CHASSIS | Mule`, `PILOT | Bonesaw`, `CRAWLER | #430`, `GAME | Rust Run`), cost.
   Then the slots (C8): state (a live reading, condition, quantity), uses, ⋯ or ✕.
   The cost sits at the seam: the last read chip, read or live; in Play the action is the Mini's Use (ruleset §1.4).
3. **Budgets** — Mention: none. Mini: rank, one context lane, cost, state; its relations are its Peek's.
   Compact (and a contentful Mini): rank, the context lane, the economy (action type, facets), traits, relations, cost, state; other measures are Full's.
   Full, Page and Peek: every class (in a Peek, relation and action chips are inert, ruleset §1.6). TitledBox and Slab: at most two summary chips, totals and caps of what they hold.
4. **Contexts** — a Mini's or Compact's container names one (else its kind's own: gear `loadout`, a thing you do `play`, an actor `roster`): `loadout` (Slots; a unit's SP), `play` (action type, or `ACTIONS | n`), `inventory` (quantity above 1), `roster` (the lead vital, `HP | 10/10`), `browse` (none).
   The model maps a context to a fact per kind; no component branches on schema.

## Rules

- **C1** Every strip is identity, then its chips, the actions inlined last (C8); nothing beside it.
- **C1a** One Size per strip: its chips and controls share one height and one centre line, Mini on a Mini, Compact on any other head.
  Controls and status chips (a condition, a stepper, Use, ⋯) are the head's chips: they live in the header under C2b's fill, never on a line of their own.
- **C2** Chips keep the class order; a form drops classes, never reorders them. No read chip follows the cost (`_chipStrips.ts`).
- **C2a** Every strip, the Page band included, is drawn by `Chips`; each chip names its class (`data-chip-class`).
- **C2b** Chips sit beside the name; the overflow goes to the body or +MORE (owner, 2026-10-20; universal: every entity, SRD and app, every form): 1. a head's chips (a Mini's, a Compact's, a Full's, a Page's chapter band and its controls) only ever sit beside its name, on the name's line, from the bottom right, the last of them (the cost, else the last slot or the page's action) in the corner, filling right to left; 2. they never make the head taller: nothing stacks above or under the name; 3. on an intentionally header-only rendering (a Mini, a bodyless Compact, the index layout with no lead, a head-only Full) what does not fit ends the strip in +MORE (C5); 4. on a contentful rendering (a Compact with a body, a Compact or Full contentful, a Page, a contentful Mini) what does not fit is the body's first row, left-aligned, in class order, ahead of the body's content. The cost, the Tech Level (rank) and the slots after the cost never leave the head; the measures (Slots, SP, HP) take their places next, in order, while they fit, and the economy and traits fill what room is left from the end; where not even they fit beside the one-line name, the name wraps between words, never inside one, and where its widest word still leaves too little, a contentful head's items in no class (a Page band's action, a contentful's type stamp) go to the first row too. One fit, measured once (`components/atoms/chipFill.ts`, a contentful Mini's `entity/parts/chipFit.ts`); `_chipStrips.ts` holds it (`taller`, `overflow`, `more-contentful`, hard rule R37). On a phone a Page's chapter band keeps its controls (not its stamps, which fill beside the title) above its title, flush right (owner, 2026-10-20), laid by CSS alone so nothing moves as the page loads; an index band's search and filters follow its title instead, under the band on the page ground, the search a line of its own and the Filters button the line's width. Until the fill has measured, a head is laid as it most often ends, so the page does not shift when it lands.
- **C3** Budgets are static: no chip is added, dropped, moved or clipped by width, content or hover; a strip never hides its overflow. What a Mini leaves out, its Peek shows. The one exception is C5's +MORE.
- **C4** A Mini's context lane is named by its container, from the closed list.
- **C5** Only the name flexes: a Mini's ends in "…", any other wraps. Chips and controls never shrink, clip or scale.
  A header-only rendering's chips are one row (C2b); what does not fit ends it in a +MORE chip (no count), the cost kept right before it, and the entity (its Peek, its Page) shows the rest. A contentful rendering never shows +MORE: its overflow is C2b's body row (owner, 2026-10-20).
- **C6** In a list of Compacts each chip class and action slot is a column every line shares (a Mini's chips pack right, no lanes); an absent value leaves its cell empty, and a lane never shrinks below its chip.
  Too narrow for every lane and a readable name (a container query), each line packs right and its empty cells collapse.
- **C7** A live reading reserves its maximum's width, in tabular figures.
- **C8** Actions are chips: inlined in the chip group after the cost, at its Size, in fixed slots: state · uses · ⋯ or ✕. Nothing sits beside a strip, and nothing expands under it: Details opens the Page.
  A state's follow-up (Repair) opens from the state slot; at most two visible, then ⋯; never hover-only.
- **C9** A mode swaps what fills a slot (a read chip, a control, a seal), never its size.
- **C10** A header's summary never repeats a child's fact or its parent's summary; Slab and TitledBox take it as one `SlabCount` list.
- **C11** A related unit or entity is a relation chip, label first, its value Peeking and opening it (a Game, which has no Peek, links to its Play page): never a loose stamp ("Assigned: X") or a Mini beside the strip. Read and Edit show the same chip. An absent relation leaves its lane empty (C6), never an "Unassigned" chip.

## Built as

- **A narrow head** — the fill (C2b) keeps the Tech Level, the cost and the slots beside the name and moves what does not fit into the body's first row, left-aligned (a header-only head: behind +MORE); the name wraps only when not even those fit beside its one line.
- **A Mini with actions** — a `div` whose name cut-out is the link and the Peek trigger, so no button sits inside a link.
