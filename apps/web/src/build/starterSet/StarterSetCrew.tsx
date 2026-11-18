/**
 * StarterSetCrew — the Starter Set's pre-generated crew as a signed-out front
 * door shows it (Build's and Play's): the section's Slab, whose crew it is,
 * then the crew as ONE Ledger (ledger.md L1), a line a build: its name the
 * link to its read-only sheet (`/starter/:kind/:id`), what kind of thing it
 * is, the class or chassis it is built on (a Mention: it Peeks and opens),
 * and its Tech Level. A mixed list, so its band is ink.
 */

import type { CSSProperties, ReactNode } from 'react'
import type { LedgerColumn } from '../../components/index'
import { CiteLine, Ledger, Mention, Slab, Stack, tokens } from '../../components/index'
import { STARTER_SET_ADVENTURE, STARTER_SET_PUBLISHER } from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import type { StarterBuild } from './starterShelves.model'
import { starterShelves } from './starterShelves.model'

const CREDIT = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.lede,
  margin: 0,
} satisfies CSSProperties

const COLUMNS: readonly LedgerColumn[] = [
  { key: 'kind', label: buildStarterSetCopy('kind'), kind: 'text', phone: true },
  { key: 'built-on', label: buildStarterSetCopy('builtOn'), kind: 'text', phone: true },
  {
    key: 'tech-level',
    label: buildStarterSetCopy('tl'),
    title: buildStarterSetCopy('techLevel'),
    kind: 'figure',
  },
]

/** What a build is built on, as a Mention of that entity; none draws the dash. */
function builtOn(build: StarterBuild): ReactNode {
  const source = build.relations[0]
  return source ? <Mention entityRef={source.ref}>{source.param}</Mention> : ''
}

function techLevel(build: StarterBuild): string {
  const fact = build.model.facts.find((entry) => entry.key === 'tech-level')
  return fact ? String(fact.value) : ''
}

type StarterSetCrewProps = {
  /** The section's id: the pitch's "Meet the Starter crew" jumps to it. */
  id: string
  /** What a visitor can do with a sheet here, after whose crew it is. */
  note: string
}

export function StarterSetCrew({ id, note }: StarterSetCrewProps) {
  const rows = starterShelves().flatMap((shelf) =>
    shelf.builds.map((build) => ({
      id: `${shelf.kind}-${build.id}`,
      name: build.name,
      entityRef: undefined,
      href: `/starter/${shelf.kind}/${build.id}`,
      cells: [build.model.kind.stamp, builtOn(build), techLevel(build)],
    }))
  )
  return (
    <Stack as="section" gap={12} aria-labelledby={id}>
      <Slab label={buildStarterSetCopy('starterSet2')} id={id} as="h2" />
      <p style={CREDIT}>
        {buildStarterSetCopy('thePreGeneratedCrewOf')} <em>{STARTER_SET_ADVENTURE}</em>
        {buildStarterSetCopy('byPublisher', { publisher: STARTER_SET_PUBLISHER })} {note}
      </p>
      <Ledger
        label={buildStarterSetCopy('starterSetCrew')}
        nameLabel={buildStarterSetCopy('crew')}
        count={rows.length}
        columns={COLUMNS}
        rows={rows}
        foot={<CiteLine text={`${STARTER_SET_ADVENTURE} // ${STARTER_SET_PUBLISHER}`} />}
      />
    </Stack>
  )
}
