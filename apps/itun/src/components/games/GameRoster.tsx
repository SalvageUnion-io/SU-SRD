/**
 * GameRoster — a Game's crew, in the hub's three columns.
 *
 * ## Why this looks like My Stuff
 *
 * `/` shows one container at a time (`Roster`): My Stuff, or a Game picked in
 * its "Showing" select. Both ask "what have we got and what can I do with it",
 * so both answer in the same three ontology-toned columns of `EntityRow`s
 * (`roster/RosterColumn.tsx`). A Game adds what a shared table needs: an owner
 * seal on every row, a way to pick up what nobody holds, and creation gated by
 * the rules in `lib/games/gameRoster.ts`.
 *
 * ## Yours first
 *
 * Each column lists **your** pilots or mechs first, in a framed YOURS group,
 * and everybody else's below — the crewmates' (their name on the seal) and the
 * unclaimed ones (an UNCLAIMED seal you press to pick it up). What you came to
 * act on is at the top; the rest of the table is the context it sits in. A
 * crawler is the crew's, owned by nobody, so its column has no YOURS group and
 * the ★ Primary leads (`groupColumn`).
 *
 * ## Creation goes through the wizards
 *
 * This renders only for the hub's ACTIVE container, so a create CTA is just a
 * link to the ordinary wizard: `entityStore.create` stamps whatever container
 * is current, which is this Game. Nothing about building a pilot changes
 * because the pilot is destined for a crew, and a second, thinner creation
 * path would drift from the real one immediately.
 *
 * ## What a row opens
 *
 * Every row has one View, to the live sheet (`rosterSheetHref`). It opens
 * editable when the row is yours to edit — your own pilots and mechs, and the
 * communal crawler — and read-only and live when it is a crewmate's; the rule
 * is in `lib/games/gameRoster.ts` and the rendering in `SheetView`. Your own
 * pilots also have Play, to the Dashboard, while the Game has a Mediator
 * (ADR-038 §1). This is the Dashboard's only entry point.
 *
 * ## Every verb that changes who has a build asks first
 *
 * Pick up, Offer to the crew, Copy to My Stuff, Remove from game, Delete and
 * Scrap each open one shared confirm (`useConfirm`) that says what will happen
 * and whether it can be undone, and do nothing until the player confirms. The
 * verbs and their words live outside this file — `useRowActions` and
 * `lib/games/rowActionCopy.ts` — so every surface offering them says the same.
 */

import { useRouter } from '@tanstack/react-router'
import { Badge, Button, buttonVariants, EntityRow, Text, tokens } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useCrawlers, useHydrateEntities, useMechs, usePilots } from '../../hooks/entities'
import type { RosterKind, RosterRow } from '../../lib/games/gameRoster'
import {
  crawlerRows,
  gameHasMediator,
  groupColumn,
  ownableRows,
  rosterSheetHref,
  tableCapabilities,
} from '../../lib/games/gameRoster'
import { rosterRowStats } from '../../lib/games/rosterRowStats'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { ColumnCreate, SegmentKind } from '../roster/RosterColumn'
import { RosterColumn, RosterGrid, RosterList, SegmentSwitch } from '../roster/RosterColumn'
import { AppLink } from '../shared/AppLink'
import { ConvexPending } from '../shared/ConvexPending'
import { useConfirm } from '../shared/useConfirm'
import { OwnerSeal } from './OwnerSeal'
import { useRowActions } from './useRowActions'

type GameRosterProps = {
  gameId: string
  /** The Game's name, for the confirms that name it; null while unknown. */
  gameName: string | null
  /** The phone's one visible column — the hub's, so it survives a switch. */
  activeSegment: SegmentKind
  onSegmentChange: (kind: SegmentKind) => void
}

/** The three columns, in the build order the app teaches everywhere else. */
const COLUMNS: ReadonlyArray<{
  kind: RosterKind
  title: string
  create: ColumnCreate
  empty: string
}> = [
  {
    kind: 'pilot',
    title: 'Pilots',
    create: { href: '/pilots/new', label: 'Create Pilot' },
    empty: 'No pilots in this game yet.',
  },
  {
    kind: 'mech',
    title: 'Mechs',
    create: { href: '/mechs/new', label: 'Create Mech' },
    empty: 'No mechs in this game yet.',
  },
  {
    kind: 'crawler',
    title: 'Crawlers',
    create: { href: '/crawlers/new', label: 'Raise a Crawler' },
    empty: 'No Union Crawler yet.',
  },
]

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
} satisfies CSSProperties

const HINT = { marginTop: tokens.space[16], textAlign: 'left' } satisfies CSSProperties

const ERROR = { ...HINT, color: tokens.color.rollCascade } satisfies CSSProperties

const FOOTNOTE = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.xs,
  marginTop: tokens.space[24],
} satisfies CSSProperties

/**
 * The YOURS group: framed in ink on the warm band ground, so your own rows read
 * as a set at a glance. Not rust — rust is the action colour, and this marks a
 * fact, not a thing to press.
 */
const YOURS = {
  backgroundColor: tokens.color.bandCream,
  borderColor: tokens.color.ink,
  borderRadius: tokens.radius.panel,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.pill,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[10],
  padding: tokens.space[10],
} satisfies CSSProperties

const GROUP = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[10],
} satisfies CSSProperties

const ITEM = { listStyle: 'none' } satisfies CSSProperties

/** Stamps sit at their own width, not stretched across the group. */
const LABEL = { alignSelf: 'flex-start' } satisfies CSSProperties

const PATTERNS_LINK = { textDecoration: 'none' } satisfies CSSProperties

export function GameRoster({ gameId, gameName, activeSegment, onSegmentChange }: GameRosterProps) {
  // Probed rather than required, the way `AppLink` does:
  // component tests render these surfaces without a RouterProvider, and a hook
  // that throws on a missing context would make the whole screen untestable.
  const router = useRouter({ warn: false })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // One confirm for every row verb; see `useRowActions`.
  const { confirm, dialog: confirmDialog } = useConfirm()
  const rowActions = useRowActions(confirm)

  const me = useQuery(api.account.me, {})
  const members = useQuery(api.games.members, { gameId: gameId as Id<'games'> })
  const listing = useQuery(api.entities.listForGame, { gameId: gameId as Id<'games'> })

  const setPrimaryCrawler = useMutation(api.games.setPrimaryCrawler)

  // Local copies decide what opens without a round trip, so the columns need
  // the local stores hydrated even though the listing itself is remote.
  useHydrateEntities(['pilot', 'mech', 'crawler'])
  const localPilots: Pilot[] = usePilots()
  const localMechs: Mech[] = useMechs()
  const localCrawlers: Crawler[] = useCrawlers()

  const viewerId = me?._id ?? null
  const roster = members ?? []
  const caps = tableCapabilities({
    viewerId,
    members: roster,
    crawlerCount: listing?.crawlers.length ?? 0,
  })
  // The Dashboard opens only in a Game with a Mediator (ADR-038 §1), so Play is
  // offered only then. The route checks it again, live.
  const mayPlay = gameHasMediator(roster)

  const rows: Record<RosterKind, RosterRow[]> = {
    pilot: ownableRows({
      kind: 'pilot',
      rows: listing?.pilots ?? [],
      viewerId,
      members: roster,
      localIds: new Set(localPilots.map((p) => p.id)),
    }),
    mech: ownableRows({
      kind: 'mech',
      rows: listing?.mechs ?? [],
      viewerId,
      members: roster,
      localIds: new Set(localMechs.map((m) => m.id)),
    }),
    crawler: crawlerRows({
      rows: listing?.crawlers ?? [],
      tableRunner: caps.tableRunner,
      localIds: new Set(localCrawlers.map((c) => c.id)),
      primaryCrawlerId: listing?.primaryCrawlerId ?? null,
    }),
  }

  async function run(key: string, work: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try {
      await work()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(null)
    }
  }

  async function play(row: RosterRow) {
    // Your own pilot is in this browser already — `ShelfSync` caches everything
    // you own — so there is nothing to fetch; a pilot still on its way in has
    // not arrived yet, and says so.
    if (row.localId === null) throw new Error('That pilot has not reached this browser yet.')
    await router?.navigate({ to: '/dashboard/$pilotId', params: { pilotId: row.localId } })
  }

  function renderRow(row: RosterRow): ReactNode {
    return (
      <li key={row.serverId} style={ITEM}>
        <EntityRow
          entityType={row.kind}
          name={row.name}
          stats={rosterRowStats(row)}
          linkAs={AppLink}
          /* Every row is a door, and there is one: View, to the live sheet —
             editable when the row is yours to edit (`row.can.openSheet`),
             read-only when it is a crewmate's (`SheetView`). */
          sheetHref={rosterSheetHref(row)}
          /* The primary crawler is where new crew is assigned (ADR-037), so
             the roster says which one it is. */
          meta={row.primary ? '★ Primary' : undefined}
          seal={
            row.owner === null ? undefined : (
              <OwnerSeal
                owner={row.owner}
                claimable={row.can.claim}
                disabled={busy !== null}
                onClaim={() => rowActions.pickUp(row)}
              />
            )
          }
          actions={
            <>
              {/* The Dashboard is keyed on the pilot, so Play is on your own
                  pilot rows; a mech is boarded from inside it. */}
              {row.kind === 'pilot' && row.owner?.mine === true && mayPlay && (
                <Button
                  variant="primary"
                  size="mini"
                  disabled={busy !== null}
                  onClick={() => void run(`play-${row.serverId}`, () => play(row))}
                >
                  Play
                </Button>
              )}
              {/* Picking up is the SEAL's job, not a button's — see
                  `OwnerSeal`. Any owner may hand back, not just the table
                  runner: ADR-030 §4 makes ownership voluntary outward, and the
                  pick-up confirm promises exactly this as the way back out. */}
              {row.can.release && (
                <Button
                  variant="ghost"
                  size="mini"
                  disabled={busy !== null}
                  onClick={() => rowActions.offer(row)}
                >
                  Offer to the crew
                </Button>
              )}
              {/* Pilots and mechs only. Copying the crawler is a product choice
                  nobody has made yet: it is the crew's shared home rather than
                  a character somebody keeps. */}
              {row.kind !== 'crawler' && (
                <Button
                  variant="ghost"
                  size="mini"
                  disabled={busy !== null}
                  onClick={() => rowActions.copy(row)}
                >
                  Copy to My Stuff
                </Button>
              )}
              {/* The move out (ADR-037): your own pilot or mech, or — for the
                  table runner — a crawler. Offered once this browser holds the
                  copy the move is made on; `ShelfSync` and `WiringSync` bring
                  it in moments after it appears here. */}
              {row.can.removeFromGame && row.localId !== null && (
                <Button
                  variant="ghost"
                  size="mini"
                  disabled={busy !== null}
                  onClick={() => rowActions.removeFromGame(row, gameName)}
                >
                  Remove from game
                </Button>
              )}
              {row.can.delete && (
                <Button
                  variant="ghost"
                  size="mini"
                  disabled={busy !== null}
                  onClick={() => rowActions.remove(row)}
                >
                  Delete
                </Button>
              )}
              {row.can.makePrimary && (
                <Button
                  variant="ghost"
                  size="mini"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(`primary-${row.serverId}`, async () => {
                      await setPrimaryCrawler({
                        gameId: gameId as Id<'games'>,
                        crawlerId: row.serverId as Id<'crawlers'>,
                      })
                    })
                  }
                >
                  Make primary
                </Button>
              )}
              {row.can.scrap && (
                <Button
                  variant="ghost"
                  size="mini"
                  disabled={busy !== null}
                  onClick={() => rowActions.scrap(row)}
                >
                  Scrap
                </Button>
              )}
            </>
          }
        />
      </li>
    )
  }

  /** A column's body: your rows framed under YOURS, then everyone else's. */
  function columnBody(kind: RosterKind, columnRows: readonly RosterRow[]): ReactNode {
    const { yours, others } = groupColumn(columnRows)
    const yoursId = `${kind}-yours-label`
    const othersId = `${kind}-others-label`
    return (
      <div style={STACK}>
        {yours.length > 0 && (
          <div style={YOURS}>
            <Badge shape="stamp" size="mini" as="h3" id={yoursId} style={LABEL}>
              Yours
            </Badge>
            <RosterList labelledBy={yoursId}>{yours.map(renderRow)}</RosterList>
          </div>
        )}
        {others.length > 0 &&
          (yours.length > 0 ? (
            <div style={GROUP}>
              <Badge
                shape="stamp"
                size="mini"
                surface="inverse"
                as="h3"
                id={othersId}
                style={LABEL}
              >
                Everyone else
              </Badge>
              <RosterList labelledBy={othersId}>{others.map(renderRow)}</RosterList>
            </div>
          ) : (
            <RosterList>{others.map(renderRow)}</RosterList>
          ))}
      </div>
    )
  }

  const loading = listing === undefined || members === undefined

  return (
    <>
      <Text variant="hint" style={HINT}>
        {caps.tableRunner
          ? 'You run this table: raise its crawler, and build characters for the crew to pick up.'
          : 'Everything the crew has brought to this game. Pick up anything nobody holds.'}
      </Text>

      {error !== null && (
        <Text variant="hint" role="alert" style={ERROR}>
          {error}
        </Text>
      )}

      {!caps.canAddCrew && caps.addCrewBlocked !== null && !loading && (
        <Text variant="hint" style={HINT}>
          {caps.addCrewBlocked}
        </Text>
      )}

      {loading ? (
        <div style={HINT}>
          <ConvexPending label="the crew" />
        </div>
      ) : (
        <>
          <SegmentSwitch active={activeSegment} onChange={onSegmentChange} />
          <RosterGrid>
            {COLUMNS.map((column) => {
              const columnRows = rows[column.kind]
              // The crawler column answers to the table runner (`createCrawler`);
              // the other two to membership (`assertMayAddToContainer`).
              const mayCreate = column.kind === 'crawler' ? caps.canRaiseCrawler : caps.canAddCrew
              return (
                <RosterColumn
                  key={column.kind}
                  kind={column.kind}
                  title={column.title}
                  active={activeSegment === column.kind}
                  create={mayCreate ? column.create : undefined}
                  emptyMessage={
                    column.kind === 'crawler' && !caps.canRaiseCrawler
                      ? 'No Union Crawler yet — the Mediator raises one.'
                      : column.empty
                  }
                  headExtra={
                    column.kind === 'mech' ? (
                      <AppLink
                        href="/mechs/patterns"
                        className={buttonVariants({ variant: 'ghost', size: 'compact' })}
                        style={PATTERNS_LINK}
                      >
                        Patterns
                      </AppLink>
                    ) : undefined
                  }
                  empty={columnRows.length === 0}
                >
                  {columnBody(column.kind, columnRows)}
                </RosterColumn>
              )
            })}
          </RosterGrid>
        </>
      )}

      <p style={FOOTNOTE}>
        What you can edit opens to edit; a crewmate&rsquo;s pilot or mech opens read-only, as it
        stands right now.
      </p>

      {confirmDialog}
    </>
  )
}
