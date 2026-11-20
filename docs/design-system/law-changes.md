# Law changes (density-best mock)

Laws the owner set while reviewing the `mock/density-best` mock, waiting to be
folded into [the ruleset](ruleset.md) if the mock is built for real.

## A cut-out shares its body

A cut-out (a band's title plate, a strip's tab, a stat tile's label) shares the
ground and the border of the body it opens into.

- **Ground:** the body sets `--cutout-ground`; the cut-out paints it. With no
  body setting it, the cut-out is the page ground.
- **Border:** the body sets `--cutout-border` (width, style, colour); the
  cut-out wears it on its three exposed sides. The side that opens into the
  body never has a border, so the two read as one shape. A body with no
  border gives its cut-out none.
- Set at the source, never page by page: a sheet's band opens into its
  masthead's paper, so the sheet sets the band's `--cutout-ground`; a Ledger's
  tab opens into its first row.

## Grounds by role

Checked against the palette's colour map (`theme.css`, ruleset §4.1); the
book's page images were not reachable from the review machine.

- **Paper** (`--color-paper`) is every reading surface: a section's body, a
  Ledger's rows, a stat tile, a sheet's masthead, a cut-out that opens into
  paper. Never a page ground.
- **Workshop ground** (`--color-wk-bg`) is the page: the column a Page stands
  on, and a cut-out that opens into it (a band's title plate over the page).
- **Desk** (`--color-desk`) is the margin beside the column from `lg`: warm
  ink over the workshop ground (16%), so it reads as the same material in
  shadow. The ink ramp is warm, never a neutral grey: of the `?mock-desk`
  comparisons only 1 (warm stone) keeps the law; 2 (slate) and 4 (mid-grey)
  break it and stay comparisons.
- **Ink deep** is chrome only: the union bar and the foot.
- **Colour lives in bands**: a chapter band, a strip, a tile's frame and foot,
  the pinned bar. A tone is never a reading ground.

## No box stands naked

A section whose body is words (a Description, a chassis ability, a sheet's
facts or prose, a guide step, a pattern's own words) sits on a paper panel
with the column's padding, as a Ledger's rows do; its strip's tab is cut from
the same paper.

## Borders by role

- **Frame:** `--bw-chrome` or `--bw-entity-compact`, in ink or the unit's
  paint, round one object (a tile, a card, a tracker).
- **Divider:** one hairline, `--bw-hairline` in ink-20, between parts of one
  surface (a masthead's cells, its tab row).
- **Strip foot:** the 2px ink rule is a band's and a Ledger strip's only.
- Nothing else draws a 2px ink line; a control keeps its own edge.

## The contrast floor

Every word passes 4.5:1 on what it stands on, 3:1 when large (24px, or
18.66px bold) or a UI edge. In practice:

- An empty cell's dash and an empty figure are ink-75, never a ghost.
- A dark swatch (TL 4 and up) carries paper.
- Crawler pink carries paper (6.4:1), never ink (3.3:1).
- A column label on a pale tone strip, and a read-only mark, are full ink.
- No text under 11px.

A gate would measure every text node against its resolved ground on the
review pages, as the review's audit did.

## Stats by kind

- **An item's stats ride the band.** A system's, module's, equipment's or
  ability's book stats (TL, Slots, SV, …) are chips on the chapter band beside
  its title, with its other stamps; its Page has no stat tiles.
- **A chassis's stats are tiles.** A chassis (and its patterns) keeps its stat
  tiles at the head of the main track: eight figures read faster as tiles than
  as a row of chips.
- **A lone description stands without a panel.** A Page whose only content is
  its description shows the prose plain on the page ground: no "Description"
  strip, no paper panel.
