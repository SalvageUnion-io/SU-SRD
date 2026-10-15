/**
 * StarterSetRoster — Leyline Press's pre-generated crew, laid out like a Game's
 * roster: three columns, a `StarterCard` per build — the same card the front
 * door lists them with.
 *
 * It is a pseudo-Game rather than a Game. Nobody is a member, nothing in it can
 * change, and it is the same for everyone — signed out included, because
 * reading it needs no account. Each card opens the build's read-only sheet
 * (`/starter/:kind/:id`), and, signed in, offers "Copy to…" Shelves or one of
 * the player's Games. The copy is theirs; the template is untouched
 * (`lib/starterSet/copyStarter.ts`).
 *
 * Rendered on its own page (`/starter`) and under the sign-in panel on a
 * signed-out Roster.
 */

import { ChapterBand, PageHeading, Text, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
import { STARTER_SET_ADVENTURE, STARTER_SET_PUBLISHER } from '../../lib/starterSet/starterTemplates'
import type { SegmentKind } from '../roster/RosterColumn'
import { RosterColumn, RosterGrid, RosterList, SegmentSwitch } from '../roster/RosterColumn'
import { useConfirm } from '../shared/useConfirm'
import { CopyStarterSelect } from './CopyStarterSelect'
import { StarterCard } from './StarterCard'
import { starterShelves } from './starterShelves.model'

const HEADER = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

// Under the signed-out Roster's sign-in panel the h2 keeps its distance. On its
// own page the band is the page shell's first child, so it bleeds to the
// masthead.
const SUB_HEADER = { ...HEADER, marginTop: tokens.space[32] } satisfies CSSProperties

// The card, then (signed in) its "Copy to…" under it: a control may not sit
// inside the card's link.
const ROW = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[6],
  listStyle: 'none',
} satisfies CSSProperties

type StarterSetRosterProps = {
  /** `h1` on its own page; `h2` under the signed-out Roster's sign-in panel. */
  headingLevel?: 'h1' | 'h2'
}

export function StarterSetRoster({ headingLevel = 'h2' }: StarterSetRosterProps) {
  const { mode } = useConnection()
  const [activeSegment, setActiveSegment] = useState<SegmentKind>('pilot')
  const { confirm, dialog } = useConfirm()
  const shelves = starterShelves()

  return (
    <>
      {headingLevel === 'h1' && <ChapterBand tone="cantina">Starter Set</ChapterBand>}
      <section aria-label="Starter Set">
        <div style={headingLevel === 'h1' ? HEADER : SUB_HEADER}>
          {headingLevel === 'h2' && <PageHeading>Starter Set</PageHeading>}
          <Text variant="body">
            The pre-generated crew of {STARTER_SET_ADVENTURE}, owned by {STARTER_SET_PUBLISHER}.
            Read-only reference: open any sheet to read it.{' '}
            {mode === 'connected'
              ? 'Copy one into your Hangar or into one of your Games to play it.'
              : 'Sign in to copy one into your Hangar or into a Game and play it.'}
          </Text>
        </div>

        <SegmentSwitch active={activeSegment} onChange={setActiveSegment} />
        <RosterGrid>
          {shelves.map(({ kind, title, builds }) => (
            <RosterColumn
              key={kind}
              kind={kind}
              title={title}
              active={activeSegment === kind}
              emptyMessage=""
              empty={false}
            >
              <RosterList>
                {builds.map((build) => (
                  <li key={build.id} style={ROW}>
                    <StarterCard kind={kind} build={build} />
                    <CopyStarterSelect
                      kind={kind}
                      templateId={build.id}
                      name={build.name}
                      confirm={confirm}
                    />
                  </li>
                ))}
              </RosterList>
            </RosterColumn>
          ))}
        </RosterGrid>
        {dialog}
      </section>
    </>
  )
}
