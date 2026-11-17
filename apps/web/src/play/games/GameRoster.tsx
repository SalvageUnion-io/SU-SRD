/**
 * GameRoster — a Game's crew on its page in Play: one list, read at a glance
 * before you sit down.
 *
 * ## Play lists the crew; Build keeps it
 *
 * Play only plays (ADR-052 §3), so the
 * crew here is not a second Training Bay. There is no create, no pattern and
 * no copy: each row opens its unit's sheet in Build, and the head
 * links out to Build for the rest — **+ New Pilot** (Build's own wizard,
 * started for this Game, `/pilots/new?game=<id>`, ADR-052 §3), the table
 * runner's **+ New Crawler** while the Game has none, and **Manage in Build**
 * (the Training Bay, which moves units in and out of Games).
 *
 * ## One list, the crawler first
 *
 * The crawler (★ Primary first), then the pilots, each with its seat (its HP)
 * and the mech assigned to it as a linked Mini, then the mechs, each its own
 * row so an unassigned one can be picked up; an assigned mech a pilot flies
 * rides its pilot's row only. Yours lead each kind; a seal says whose a row is (`OwnerSeal`),
 * an UNASSIGNED seal assigning it to you. The head counts the seats.
 *
 * ## What stays here
 *
 * The verbs about a unit's place at this table, in a row's ⋯ menu: Unassign
 * (its holder's, or the table runner's), Assign to each member (the table
 * runner's), Make primary (the table runner's crawler), Move to your Training
 * Bay and Delete… (your own, or the table runner's crawler).
 * Each asks first through one shared confirm (`useConfirm`); their words live
 * in `useRowActions` and `lib/games/rowActionCopy.ts`.
 */

import { PRODUCT } from 'game-domain/product'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { CSSProperties, ReactNode } from 'react'
import type { HeaderMenuItem } from '../../components/index'
import {
  Button,
  Entity,
  FieldError,
  HeaderMenu,
  RosterSkeleton,
  SlabSection,
  Text,
  tokens,
} from '../../components/index'
import { useConfirm } from '../../components/shared/useConfirm'
import { useGo } from '../../components/shared/useGo'
import { useServerAction } from '../../lib/connection/useServerAction'
import { useCrawlers, useHydrateEntities, useMechs, usePilots } from '../../lib/entities'
import type { RosterRow } from '../../lib/games/gameRoster'
import {
  bodyIdOf,
  crawlerRows,
  groupColumn,
  ownableRows,
  rosterSheetHref,
  tableCapabilities,
} from '../../lib/games/gameRoster'
import { gauge, pool } from '../../lib/units/crewPair'
import { VITAL } from '../../lib/units/readings'
import { unitRowModel } from '../../lib/units/unitModel'
import { newInGameHref } from '../../lib/wizard/fromGame'
import { playGamesCopy } from '../../messages/play-games'
import { useGameListing } from '../../replica/gameListing'
import { useGamesCall, useViewerId } from '../../replica/roomCalls'
import { useTableRead } from '../../replica/useTable'
import { readCrawler } from './crawlerReading.model'
import { OwnerSeal } from './OwnerSeal'
import type { SeatRow } from './seatRows.model'
import { seatRows } from './seatRows.model'
import { useRowActions } from './useRowActions'

/** MOCK (Working Manual F): the crew table's vitals, the Mediator screen's columns. */
const CREW_VITALS = ['HP', 'SP', 'EP', 'Heat'] as const

type GameRosterProps = {
  gameId: string
  /** The Game's name, for the confirms that name it; null while unknown. */
  gameName: string | null
}

const HINT = { textAlign: 'left' } satisfies CSSProperties

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

export function GameRoster({ gameId, gameName }: GameRosterProps) {
  // One confirm for every row verb; see `useRowActions`.
  const { confirm, dialog: confirmDialog } = useConfirm()
  const rowActions = useRowActions(confirm, gameId)
  const go = useGo()

  const members = useTableRead('games.members', { gameId })
  const listing = useGameListing(gameId)
  // The pilots' HP: the server derives every crewmate's max (ADR-038 §4).
  const vitals = useTableRead('crew.vitals', { gameId })

  const makePrimary = useServerAction(useGamesCall('games.setPrimaryCrawler'), {
    failure: 'That crawler could not be made primary. Try again.',
  })
  const busy = makePrimary.pending
  const error = makePrimary.error

  // Local copies decide what opens without a round trip, so the list needs
  // the local stores hydrated even though the listing itself is remote.
  useHydrateEntities(['pilot', 'mech', 'crawler', 'softLink'])
  const localPilots: Pilot[] = usePilots()
  const localMechs: Mech[] = useMechs()
  const localCrawlers: Crawler[] = useCrawlers()

  const viewerId = useViewerId()
  const roster = members ?? []
  const caps = tableCapabilities({
    viewerId,
    members: roster,
    crawlerCount: listing?.crawlers.length ?? 0,
  })

  const pilots = ownableRows({
    kind: 'pilot',
    rows: listing?.pilots ?? [],
    viewerId,
    members: roster,
    localIds: new Set(localPilots.map((p) => p.id)),
  })
  // An assigned, piloted mech rides its pilot's row (`rowChips`) only; an
  // unassigned one keeps its own so its seal can assign it.
  const piloted = new Set(
    (listing?.softLinks ?? []).flatMap((l) => (l.type === 'mech-to-pilot' ? [l.from.id] : []))
  )
  const mechs = ownableRows({
    kind: 'mech',
    rows: (listing?.mechs ?? []).filter(
      (m) => m.ownerId === null || !piloted.has(m.appId ?? bodyIdOf(m.body) ?? '')
    ),
    viewerId,
    members: roster,
    localIds: new Set(localMechs.map((m) => m.id)),
  })
  const crawlers = crawlerRows({
    rows: listing?.crawlers ?? [],
    tableRunner: caps.tableRunner,
    localIds: new Set(localCrawlers.map((c) => c.id)),
    primaryCrawlerId: listing?.primaryCrawlerId ?? null,
  })
  // The seats are no section of their own: each pilot's HP and mech ride its row, the
  // head counts the assigned ones, the crawler's row its vitals.
  const seats =
    listing === undefined || members === undefined
      ? null
      : seatRows(listing, members, viewerId, vitals)
  const seatOf = new Map<string, SeatRow>(seats?.rows.map((seat) => [seat.key, seat]) ?? [])
  const crawlerOf = new Map((listing?.crawlers ?? []).map((c) => [c._id as string, readCrawler(c)]))

  /**
   * A row's verbs about its place at this table, in its ⋯ menu: the Compact
   * itself opens the sheet in Build, where everything else about a unit is done.
   */
  function rowMenu(row: RosterRow): HeaderMenuItem[][] {
    const act = (run: () => void) => (busy ? undefined : run)
    const verbs: HeaderMenuItem[] = [
      { id: 'open', label: playGamesCopy('openSheet'), onSelect: () => go(rosterSheetHref(row)) },
    ]
    // Assigning yourself a free one is the SEAL's job, not a menu row's
    // (`OwnerSeal`). Any holder may hand back, not just the table runner:
    // ADR-030 §4 makes an assignment voluntary outward, and the seal's confirm
    // promises this way back out.
    if (row.can.unassign) {
      verbs.push({
        id: 'unassign',
        label: playGamesCopy('unassign'),
        onSelect: act(() => rowActions.unassign(row)),
      })
    }
    if (row.can.makePrimary) {
      verbs.push({
        id: 'primary',
        label: playGamesCopy('makePrimary'),
        onSelect: act(
          () =>
            void makePrimary.run({
              gameId: gameId,
              crawlerId: row.serverId,
            })
        ),
      })
    }
    // The move out (ADR-037): your own pilot or mech, or (for the table
    // runner) a crawler, once this browser holds the copy the move is made on.
    if (row.can.removeFromGame && row.localId !== null) {
      verbs.push({
        id: 'remove',
        label: playGamesCopy('moveToYour', { build: PRODUCT.build }),
        onSelect: act(() => rowActions.removeFromGame(row, gameName)),
      })
    }
    // Leaving the table's roster for good: your own build, or (for the table
    // runner) the crawler. Copying is Build's.
    const danger: HeaderMenuItem[] = []
    if (row.can.delete || row.can.scrap) {
      danger.push({
        id: 'delete',
        label: playGamesCopy('delete2'),
        tone: 'danger',
        onSelect: act(() => (row.can.delete ? rowActions.remove(row) : rowActions.scrap(row))),
      })
    }
    // The table runner places it with anyone in the Game (ADR-030 §4).
    const assign: HeaderMenuItem[] = row.can.assignTo.map((member) => {
      const self = member.userId === viewerId
      return {
        id: `assign-${member.userId}`,
        label: self
          ? playGamesCopy('assignToMe')
          : playGamesCopy('assignTo', { name: member.displayName }),
        onSelect: act(() => rowActions.assignTo(row, member, self)),
      }
    })
    return [verbs, assign, danger]
  }

  /**
   * MOCK (Working Manual F): a unit's line of the crew table. The name is its
   * header-only Mini, the door to its sheet; a pilot's mech is a Mini beside
   * it, and the mech's SP, EP and Heat ride the pilot's line (`crew.vitals`).
   */
  function renderTableRow(row: RosterRow): ReactNode {
    const seat = row.kind === 'pilot' ? seatOf.get(row.serverId) : undefined
    const live = vitals?.pilots.find((p) => p._id === row.serverId)
    const mechLive =
      row.kind === 'mech'
        ? vitals?.mechs.find((m) => m._id === row.serverId)
        : live?.mechId == null
          ? undefined
          : vitals?.mechs.find((m) => (m.linkId ?? m._id) === live.mechId)
    const crawler = row.kind === 'crawler' ? crawlerOf.get(row.serverId) : undefined
    const of = (readings: readonly { value: string }[]) => readings[0]?.value ?? null
    const cells: Record<(typeof CREW_VITALS)[number], string | null> = {
      HP: seat?.hp ?? null,
      SP: crawler
        ? `${crawler.sp}/${crawler.maxSP}`
        : mechLive
          ? of(pool(VITAL.sp, mechLive.currentSP, mechLive.maxSP))
          : null,
      EP: mechLive ? of(pool(VITAL.ep, mechLive.currentEP, mechLive.maxEP)) : null,
      Heat: mechLive ? of(gauge(VITAL.heat, mechLive.currentHeat, mechLive.maxHeat)) : null,
    }
    const mech = seat?.pilot?.mech ?? null
    return (
      <tr key={row.serverId}>
        <th scope="row">
          <Entity
            size="mini"
            context="roster"
            model={unitRowModel({ kind: row.kind, name: row.name })}
            mode={{ kind: 'link', href: rosterSheetHref(row) }}
          />
        </th>
        <td>
          {mech !== null ? (
            <Entity
              size="mini"
              context="roster"
              model={unitRowModel({ kind: 'mech', name: mech })}
              mode={
                seat?.pilot?.mechHref
                  ? { kind: 'link', href: seat.pilot.mechHref }
                  : { kind: 'read' }
              }
            />
          ) : row.kind === 'pilot' ? (
            <Text variant="hint">No mech</Text>
          ) : null}
        </td>
        {CREW_VITALS.map((label) => (
          <td key={label} data-num="" data-empty={cells[label] === null ? '' : undefined}>
            {cells[label] ?? '–'}
          </td>
        ))}
        <td>
          {row.owner === null ? (
            row.kind === 'crawler' ? (
              <Text variant="hint">The crew's</Text>
            ) : null
          ) : row.owner.unassigned || row.owner.mine ? (
            <OwnerSeal
              owner={row.owner}
              assignable={row.can.assignSelf}
              disabled={busy}
              onAssign={() => rowActions.assignSelf(row)}
            />
          ) : (
            row.owner.label
          )}
        </td>
        <td data-menu="">
          <HeaderMenu
            variant="overflow"
            size="compact"
            trigger={null}
            label={playGamesCopy('moreFor', { name: row.name })}
            sections={rowMenu(row)}
          />
        </td>
      </tr>
    )
  }

  /** Each kind's rows, yours first, then everyone else's. */
  const ordered = (rows: readonly RosterRow[]) => {
    const { yours, others } = groupColumn(rows)
    return [...yours, ...others]
  }
  const rows = [...ordered(crawlers), ...ordered(pilots), ...ordered(mechs)]
  const loading = listing === undefined || members === undefined

  return (
    <>
      <SlabSection
        as="h2"
        id="crew-heading"
        title={playGamesCopy('crew')}
        {...(seats !== null && seats.total > 0
          ? { count: { label: playGamesCopy('seats'), value: seats.claimed, max: seats.total } }
          : {})}
        // MOCK (Working Manual F, principle 9): + New steps down to outline; the
        // page's one rust button is the role's door on the band. Bends R55
        // (every + New rust).
        actions={
          <>
            {caps.canAddCrew && (
              <Button href={newInGameHref('/pilots/new', gameId)} variant="default" size="compact">
                {playGamesCopy('newPilot')}
              </Button>
            )}
            {caps.canAddCrew && (
              <Button href={newInGameHref('/mechs/new', gameId)} variant="default" size="compact">
                {playGamesCopy('newMech')}
              </Button>
            )}
            {caps.canRaiseCrawler && !caps.hasCrawler && (
              <Button
                href={newInGameHref('/crawlers/new', gameId)}
                variant="default"
                size="compact"
              >
                {playGamesCopy('newCrawler')}
              </Button>
            )}
            <Button href="/" variant="default" size="compact">
              {playGamesCopy('manageInBuild')}
            </Button>
          </>
        }
        bodyStyle={BODY}
      >
        {error !== null && <FieldError>{error}</FieldError>}
        {!caps.canAddCrew && caps.addCrewBlocked !== null && !loading && (
          <Text variant="hint" style={HINT}>
            {caps.addCrewBlocked}
          </Text>
        )}
        {loading ? (
          <RosterSkeleton label={playGamesCopy('theCrew')} />
        ) : rows.length === 0 ? (
          <Text variant="hint" style={HINT}>
            {playGamesCopy('nobodyHasBroughtAUnit')}
          </Text>
        ) : (
          // MOCK (Working Manual F, principle 5): the crew reads as a table, a
          // row a unit, its vitals in the Mediator screen's columns.
          <div className="su-crew-table-scroll">
            <table className="su-crew-table" aria-labelledby="crew-heading">
              <thead>
                <tr>
                  <th scope="col">Unit</th>
                  <th scope="col">Mech</th>
                  {CREW_VITALS.map((label) => (
                    <th key={label} scope="col" data-num="">
                      {label}
                    </th>
                  ))}
                  <th scope="col">Player</th>
                  <th scope="col">
                    <span className="su-sr-only">More</span>
                  </th>
                </tr>
              </thead>
              <tbody>{rows.map(renderTableRow)}</tbody>
            </table>
          </div>
        )}
      </SlabSection>

      {confirmDialog}
    </>
  )
}
