/**
 * StarterSetRoster — Leyline Press's pre-generated crew, laid out like a Game's
 * roster: three columns, a row per build, each stamped with its owner.
 *
 * It is a pseudo-Game rather than a Game. Nobody is a member, nothing in it can
 * change, and it is the same for everyone — signed out included, because
 * reading it needs no account. Each row opens the build's read-only sheet
 * (`/starter/:kind/:id`), and, signed in, offers "Copy to…" My Stuff or one of
 * the player's Games. The copy is theirs; the template is untouched
 * (`lib/starterSet/copyStarter.ts`).
 *
 * Rendered on its own page (`/starter`) and under the sign-in panel on a
 * signed-out Roster.
 */

import { Badge, ChapterBand, PageHeading, Text, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
import type { StarterKind } from '../../lib/starterSet/copyStarter'
import { STARTER_SET_ADVENTURE, STARTER_SET_PUBLISHER } from '../../lib/starterSet/copyStarter'
import { STARTER_CRAWLERS, STARTER_MECHS, STARTER_PILOTS } from '../../lib/starterSet/starterSet'
import type { SegmentKind } from '../roster/RosterColumn'
import { RosterColumn, RosterGrid, RosterList, SegmentSwitch } from '../roster/RosterColumn'
import { crawlerStats, mechChassisStats, pilotStats } from '../roster/rowStats'
import { AppLink } from '../shared/AppLink'
import type { EntityRowStat } from '../shared/EntityRow'
import { EntityRow } from '../shared/EntityRow'
import { useConfirm } from '../shared/useConfirm'
import { CopyStarterSelect } from './CopyStarterSelect'

const HEADER = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  marginTop: tokens.space[32],
} satisfies CSSProperties

const ROW = { listStyle: 'none' } satisfies CSSProperties

type Row = { id: string; name: string; stats: EntityRowStat[] | undefined }

const COLUMNS: { kind: StarterKind; title: string; rows: Row[] }[] = [
  {
    kind: 'pilot',
    title: 'Pilots',
    rows: STARTER_PILOTS.map((p) => ({
      id: p.id,
      name: p.name,
      stats: pilotStats(p.classRef, p.callsign),
    })),
  },
  {
    kind: 'mech',
    title: 'Mechs',
    rows: STARTER_MECHS.map((m) => ({
      id: m.id,
      name: m.name,
      stats: mechChassisStats(m.chassisRef),
    })),
  },
  {
    kind: 'crawler',
    title: 'Crawlers',
    rows: STARTER_CRAWLERS.map((c) => ({
      id: c.id,
      name: c.name,
      stats: crawlerStats(c.techLevel, c.crawlerBays?.length ?? 0),
    })),
  },
]

type StarterSetRosterProps = {
  /** `h1` on its own page; `h2` under the signed-out Roster's sign-in panel. */
  headingLevel?: 'h1' | 'h2'
}

export function StarterSetRoster({ headingLevel = 'h2' }: StarterSetRosterProps) {
  const { mode } = useConnection()
  const [activeSegment, setActiveSegment] = useState<SegmentKind>('pilot')
  const { confirm, dialog } = useConfirm()

  return (
    <section aria-label="Starter Set">
      <div style={HEADER}>
        {headingLevel === 'h1' ? (
          <ChapterBand>Starter Set</ChapterBand>
        ) : (
          <PageHeading>Starter Set</PageHeading>
        )}
        <Text variant="body">
          The pre-generated crew of {STARTER_SET_ADVENTURE}, owned by {STARTER_SET_PUBLISHER}.
          Read-only reference: open any sheet to read it.{' '}
          {mode === 'connected'
            ? 'Copy one onto your shelf or into one of your Games to play it.'
            : 'Sign in to copy one onto your shelf or into a Game and play it.'}
        </Text>
      </div>

      <SegmentSwitch active={activeSegment} onChange={setActiveSegment} />
      <RosterGrid>
        {COLUMNS.map(({ kind, title, rows }) => (
          <RosterColumn
            key={kind}
            kind={kind}
            title={title}
            active={activeSegment === kind}
            emptyMessage=""
            empty={false}
          >
            <RosterList>
              {rows.map((row) => (
                <li key={row.id} style={ROW}>
                  <EntityRow
                    entityType={kind}
                    name={row.name}
                    sheetHref={`/starter/${kind}/${row.id}`}
                    linkAs={AppLink}
                    seal={
                      <Badge shape="stamp" size="mini">
                        {STARTER_SET_PUBLISHER}
                      </Badge>
                    }
                    stats={row.stats}
                    actions={
                      <CopyStarterSelect
                        kind={kind}
                        templateId={row.id}
                        name={row.name}
                        confirm={confirm}
                      />
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
  )
}
