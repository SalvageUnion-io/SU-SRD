/**
 * StarterSetGrid — the Starter Set's thirteen builds as the front door lays
 * them out: a column per kind (pilots, mechs, the crawler), each under its own
 * Slab, every build a `StarterCard`. The front door shows it signed out; the
 * Hangar shows the same grid, folded, under your own builds (owner,
 * 2026-10-15).
 */

import type { CSSProperties } from 'react'
import { Grid, Slab, Stack, tokens } from '../../components/index'
import { StarterCard } from './StarterCard'
import { starterShelves } from './starterShelves.model'

/** Cards that fit as many ~18rem columns as there is room for; one on a phone. */
const GRID = { alignItems: 'start' } satisfies CSSProperties

const CARDS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

export function StarterSetGrid() {
  return (
    <Grid min="18rem" gap={16} style={GRID}>
      {starterShelves().map((shelf) => (
        <Stack
          as="section"
          gap={12}
          key={shelf.kind}
          aria-label={`Starter Set ${shelf.title.toLowerCase()}`}
        >
          {/* Each kind's section stamp is a Slab, as on `/starter` (ruleset
              §3.2: slabs section). */}
          <Slab as="h3" label={shelf.title} />
          <ul style={CARDS}>
            {shelf.builds.map((build) => (
              <li key={build.id}>
                <StarterCard kind={shelf.kind} build={build} />
              </li>
            ))}
          </ul>
        </Stack>
      ))}
    </Grid>
  )
}
