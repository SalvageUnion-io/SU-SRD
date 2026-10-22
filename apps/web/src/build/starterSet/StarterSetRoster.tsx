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
 * The band's control copies the whole crew at once (`CopyCrew`), and
 * `?copy=crew` offers that copy on arrival: the SRD's Starter Set landing
 * links here with it.
 *
 * Rendered on its own page (`/starter`) and under the sign-in panel on a
 * signed-out Roster.
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { ChapterBand, Slab, Text, tokens } from '../../components/index'
import { useConfirm } from '../../components/shared/useConfirm'
import { useConnection } from '../../lib/connection/connectionContext'
import { STARTER_SET_ADVENTURE, STARTER_SET_PUBLISHER } from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import type { SegmentKind } from '../roster/RosterColumn'
import { RosterColumn, RosterGrid, RosterList, SegmentSwitch } from '../roster/RosterColumn'
import { CopyCrew } from './CopyCrew'
import { CopyStarterMenu } from './CopyStarterMenu'
import { StarterCard } from './StarterCard'
import { starterShelves } from './starterShelves.model'
import { useCopyCrewOnArrival } from './useCopyCrewOnArrival'

const HEADER = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

// Under the signed-out Roster's sign-in panel the h2 keeps its distance. On its
// own page the band is the page shell's first child, so it bleeds to the
// masthead.
const SUB_HEADER = { ...HEADER, marginTop: tokens.space[32] } satisfies CSSProperties

const ROW = { listStyle: 'none' } satisfies CSSProperties

type StarterSetRosterProps = {
  /** `h1` on its own page; `h2` under the signed-out Roster's sign-in panel. */
  headingLevel?: 'h1' | 'h2'
  /** The page's `?copy=`: `crew` offers the whole crew's copy on arrival. */
  copy?: string
}

export function StarterSetRoster({ headingLevel = 'h2', copy }: StarterSetRosterProps) {
  const { mode } = useConnection()
  const [activeSegment, setActiveSegment] = useState<SegmentKind>('pilot')
  const { confirm, dialog } = useConfirm()
  const shelves = starterShelves()
  useCopyCrewOnArrival(copy, confirm)

  return (
    <>
      {headingLevel === 'h1' && (
        <ChapterBand tone="build" aside={<CopyCrew confirm={confirm} />} asideAt="controls">
          {buildStarterSetCopy('starterSet2')}
        </ChapterBand>
      )}
      <section aria-label={buildStarterSetCopy('starterSet2')}>
        <div style={headingLevel === 'h1' ? HEADER : SUB_HEADER}>
          {headingLevel === 'h2' && (
            <Slab as="h2" label={buildStarterSetCopy('starterSet2')} flush />
          )}
          <Text variant="body">
            The pre-generated crew of {STARTER_SET_ADVENTURE}, owned by {STARTER_SET_PUBLISHER}.
            Read-only reference: open any sheet to read it.{' '}
            {mode === 'connected'
              ? buildStarterSetCopy('copyOneIntoYourTraining')
              : buildStarterSetCopy('signInToCopyOne')}
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
                    {/* Signed in, "Copy to…" is the Compact's last chip (C8, hard rule R6). */}
                    <StarterCard
                      kind={kind}
                      build={build}
                      controls={
                        mode === 'connected' ? (
                          <CopyStarterMenu
                            kind={kind}
                            templateId={build.id}
                            name={build.name}
                            confirm={confirm}
                          />
                        ) : undefined
                      }
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
