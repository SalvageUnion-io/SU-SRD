# Entity Display Language

**Status:** agreed. Being implemented phase by phase on `design-refresh`
([migration](#migration)); phase 1, the model, phase 2, the Row and Token
forms with the link and select modes (`<Entity>` in
`packages/component-lib/src/entity/`), and phase 3, the Mention and the Peek,
have landed.

One rendering path for every game entity, in the SRD and in ITUN alike,
designed from what the person is doing rather than from the app.
[`ruleset.md`](ruleset.md) stays the governing law for primitives, tokens and
contexts; this doc is the law for **how an entity is drawn**. Where the two
disagree, amend one of them first.

## The pipeline

**Entity → Model → Form → Mode.** Only the last two are React.

1. **Entity:** a record from `salvageunion-reference`, plus an optional
   instance (a player's copy: condition, uses, count, notes, title, user-made).
2. **Model:** `toEntityModel(entity, instance?)` in
   `packages/salvageunion-reference/lib/view/`. Pure, serialisable, tested
   without a DOM, and shared by the SRD, ITUN and the Discord bot. It resolves
   identity, kind, tone, facts, traits, lead, prose, actions, children, table,
   art and citation once. Its shape is `lib/view/types.ts`; its parts are
   `lib/view/parts/`. No form computes a fact of its own.
3. **Form:** which parts to draw, in a fixed order.
4. **Mode:** which affordances fill the form's reserved slots.

The surface supplies context once (how a reference resolves, whether bands
carry texture, the user-made treatment); nothing passes it per call.

## Forms

| Form | Job | Anatomy |
| --- | --- | --- |
| **Mention** | Name an entity in prose | The name in the prose's own type, linked where a route exists; hover or long-press opens a Peek |
| **Token** | Identify one among many on a line | `[kind] name [one fact]`; one size; always opens its entity, and hover or long-press opens a Peek |
| **Row** | Every list: scan, compare, choose, hold | Art column (≥ 18rem, schema has art), head (tier, name, cost pennant, mode slot), paper body (facts, traits, lead while browsing) |
| **Card** | The whole entity, in place | Seam stamps, head, facts, prose, actions as bands, children as Rows, table as a roll bar, cite. Two densities by container: comfortable (≥ 30rem) and compact |
| **Page** | The detail view: learn, cite, share | Chapter band, title and stamps, parent link, art as hero, prose, stat column, actions, children, table, patterns, foot citation. An SRD route; a drawer (desktop) or sheet (phone) in ITUN |

A **Peek** is a Card at compact density: read-only, no links, children as
Tokens. A Mention or a Tag carries only its entity's address (`data-peek`);
each app mounts one `PeekHost`, which shows the Peek on hover, keyboard focus
or a long press, so a server-rendered page Peeks as well as a live one, and
the popup, its card and the schema it reads load on the first Peek.

An **entity grid** (`data-entity-grid` on the list) lays Rows out as equals:
every Row in it is the same height at every width, and every head reserves its
name's two lines, so the heads end on one line and the bodies start on one.
Outside a grid a Row is its own height.

A **Page** wastes no column on its art. At desktop width (64rem and up) the
hero floats left (42% of the column, capped at 32rem tall; a censor mark 30%)
and the opening, stat column, actions and trays run beside it, then take the
full width once they pass it: each section, card and tray narrows beside the
float rather than running under it. The ability tree, pattern rows and
anything after them clear the art and start full width. A tray on a Page has
no frame to inset from, so it spans the column (`CardTray`'s `flush`). On a
phone the art stacks above the body.

## Modes

One discriminated value per form; a mode fills slots and never changes the
anatomy.

| Mode | For | Affordance | Forms |
| --- | --- | --- | --- |
| read | Peek, page bodies, reviews | none | all |
| link | SRD lists, ITUN "open" | whole surface + head chevron | Mention, Token, Row |
| select | pickers, wizards | ink ring + "Selected" seal | Row, Card |
| count | choosing quantities | foot stepper + "N added" seal | Row |
| hold | sheet slots, trays, opposition | head condition stamp, foot uses/notes, disclosure to a Card | Token, Row, Card |
| act | decks, resolve panels | the cost pennant is the button | Row, Card |

## Hard rules

Each is checkable; breaking one needs an amendment here first.

- **E1** Choose the form by the job and the room, never by the app.
- **E2** Every list of entities is a list of Rows (grid, masonry and columns are layout). The SRD catalog view is retired.
- **E3** Use a Token only when a Row will not fit: three or more on a line, or a slot under 12rem.
- **E4** An entity named in prose is a Mention: Peek on hover or long-press, the Page on click. Never a chip, Stat or raw markup.
- **E5** The detail view is always a Page: no large-card modals, no new-tab `window.open`.
- **E6** Nest one form down, two levels deep (Page → Row, Card → Row, Row → count chip); a third level is a link or a Peek.
- **E7** Modes fill slots; they never change anatomy.
- **E8** There is one way to fold: a Row's disclosure expands it into a Card in place.
- **E9** Facts are Stats, traits are Mentions or Tags, citations are Tags, sections are Slabs, kinds are Stamps ([ruleset §3](ruleset.md#3-cross-cutting-laws)).
- **E10** Art appears by schema and room, not by prop; an entity without art shows its censor mark.
- **E11** The lead appears only while browsing (SRD listings and search page).
- **E12** Fill follows kind: "have" entities wear their tone; "do" entities (abilities, actions) their tier tone as a Row and ink as a Card or Page. Never chosen per call.
- **E13** Texture and the user-made treatment come from the surface and the instance.
- **E14** Tables are the Table instrument: a roll bar in a Card, the roll instrument on a Page or panel.
- **E15** No hand-built entity markup outside `component-lib/src/entity/` (lint-enforced once phase 6 lands).
- **E16** A Peek is read-only and terminal.
- **E17** There is no "//" line. The action type is a head stamp; range, damage and other facets are Stat cells after the entity's own facts; traits are Tags with a parameter cell (`[Burn | 2]`), after the Stats. An action with no facets has a body of rules text only.

## Which form, where

| Surface | Form | Mode |
| --- | --- | --- |
| SRD listing | Row (art, lead) | link |
| SRD entity, pattern, table, guide page | Page | read; children link |
| SRD and ITUN search | Row (no lead) | link |
| Any prose | Mention | Peek, then Page |
| ITUN wizard or picker | Row; Card for the focused pick | select / count |
| ITUN live sheet | Row expanding to Card | hold |
| ITUN dense slots (inventory strip, bays, loadouts) | Token | hold / link |
| ITUN deck / resolve | Row / Card | act |
| ITUN reference panel, "open" anywhere | Page in a drawer (sheet on phone) | read |
| Mediator opposition tray | Row | hold |
| Link previews (OG), Discord bot | fed by the model | — |

## Decisions

| Question | Decision |
| --- | --- |
| SRD catalog view | Retired; listing Rows carry the art and the lore |
| ITUN detail view | The Page in a right-hand drawer on desktop, a full-height sheet on phone |
| "Do" entity fill | Tier tone as a Row; ink as a Card or Page |
| Mentions in ITUN | Peek on hover or long-press; a click opens the Page |
| Where the model lives | `salvageunion-reference` (`lib/view/`) |
| The "//" line | Retired (E17): action type, facets and traits are modelled apart |
| When to start | Now, phase by phase; each merges with every gate green |

## Migration

| Phase | What | Done when |
| --- | --- | --- |
| 1 Model | `toEntityModel` and its parts, ported from the card's helpers, which now read them | Parity over every entity and pattern (`entityModelParity.test.ts` in component-lib) |
| 2 Row + Token | The forms, link and select modes, the `ReferenceEntityCard` adapter for head and shortform | Listings, search, pickers, loadouts and bays on Row/Token |
| 3 Mention + Peek | Every in-prose reference and trait; the tooltip card becomes the Peek | No raw `[[` markup in rendered HTML |
| 4 Card + Hold | Card densities, the Row ⇄ Card disclosure, hold and count modes | Sheets, wizards, opposition and decks migrated |
| 5 Page + instruments | The Page as route and panel, the Table instrument, guide Steps | One roll-table renderer; the catalog view removed |
| 6 Delete | Remove `ReferenceEntityCard` and its axes; add the E15 lint | `card/` gone |
