/**
 * StarterSetGrid — a book crew's builds as the front door lays them out (the
 * Starter Set's by default): a column per kind (pilots, mechs, the crawler),
 * each under its own Slab, every build a `StarterCard`. The front door shows
 * the Starter Set's signed out; the Training Bay shows each crew's grid,
 * folded, under your own builds.
 */

import type { CSSProperties } from 'react'
import { Grid, Slab, Stack, tokens } from '../../components/index'
import type { StarterRosterId } from '../../lib/starterSet/starterTemplates'
import { starterRoster } from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
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

export function StarterSetGrid({ roster = 'starter-set' }: { roster?: StarterRosterId }) {
  const { name } = starterRoster(roster)
  return (
    <Grid min="18rem" gap={16} style={GRID}>
      {starterShelves(roster)
        .filter((shelf) => shelf.builds.length > 0)
        .map((shelf) => (
          <Stack
            as="section"
            gap={12}
            key={shelf.kind}
            aria-label={buildStarterSetCopy('crewKind', {
              crew: name,
              lowerCase: shelf.title.toLowerCase(),
            })}
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
