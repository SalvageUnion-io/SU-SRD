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
 * row so an unclaimed one can be picked up. Yours lead each kind; a seal says whose a row is (`OwnerSeal`),
 * an UNCLAIMED seal picking it up. The head counts the seats.
 *
 * ## What stays here
 *
 * The verbs about a unit's place at this table, in a row's ⋯ menu: Offer to
 * the crew, Make primary (the table runner's crawler), Move to your Training
 * Bay and Delete… (your own, or the table runner's crawler).
 * Each asks first through one shared confirm (`useConfirm`); their words live
 * in `useRowActions` and `lib/games/rowActionCopy.ts`.
 */

import { useMutation, useQuery } from 'convex/react'
import { PRODUCT } from 'game-domain/product'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { CSSProperties, ReactNode } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { HeaderMenuItem } from '../../components/index'
import {
  Button,
  FieldError,
  HeaderMenu,
  RosterSkeleton,
  SlabSection,
  Text,
  tokens,
} from '../../components/index'
import { UnitRow } from '../../components/shared/UnitRow'
import { useConfirm } from '../../components/shared/useConfirm'
import { useGo } from '../../components/shared/useGo'
import { useServerAction } from '../../lib/connection/useServerAction'
import { useCrawlers, useHydrateEntities, useMechs, usePilots } from '../../lib/entities'
import type { RosterRow } from '../../lib/games/gameRoster'
import {
  crawlerRows,
  groupColumn,
  ownableRows,
  rosterSheetHref,
  tableCapabilities,
} from '../../lib/games/gameRoster'
import { gauge, pool } from '../../lib/units/crewPair'
import { newInGameHref } from '../../lib/wizard/fromGame'
import { crawlerVitals, readCrawler } from './crawlerReading.model'
import { OwnerSeal } from './OwnerSeal'
import type { SeatRow } from './seatRows.model'
import { seatRows } from './seatRows.model'
import { useRowActions } from './useRowActions'

type GameRosterProps = {
  gameId: string
  /** The Game's name, for the confirms that name it; null while unknown. */
  gameName: string | null
}

const HINT = { textAlign: 'left' } satisfies CSSProperties

const ITEM = { listStyle: 'none', minWidth: 0 } satisfies CSSProperties

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

export function GameRoster({ gameId, gameName }: GameRosterProps) {
  // One confirm for every row verb; see `useRowActions`.
  const { confirm, dialog: confirmDialog } = useConfirm()
  const rowActions = useRowActions(confirm)
  const go = useGo()

  const me = useQuery(api.account.me, {})
  const members = useQuery(api.games.members, { gameId: gameId as Id<'games'> })
  const listing = useQuery(api.entities.listForGame, { gameId: gameId as Id<'games'> })
  // The pilots' HP: the server derives every crewmate's max (ADR-038 §4).
  const vitals = useQuery(api.crew.vitals, { gameId: gameId as Id<'games'> })

  const makePrimary = useServerAction(useMutation(api.games.setPrimaryCrawler), {
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

  const viewerId = me?._id ?? null
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
  const mechs = ownableRows({
    kind: 'mech',
    rows: listing?.mechs ?? [],
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
  // head counts the claimed ones, the crawler's row its vitals.
  const seats =
    listing === undefined || members === undefined
      ? null
      : seatRows(listing, members, viewerId, vitals)
  const seatOf = new Map<string, SeatRow>(seats?.rows.map((seat) => [seat.key, seat]) ?? [])
  const crawlerOf = new Map((listing?.crawlers ?? []).map((c) => [c._id as string, readCrawler(c)]))

  /** A row's readings and linked units: a pilot's seat (HP, its mech), a crawler's vitals. */
  function rowChips(row: RosterRow): Pick<Parameters<typeof UnitRow>[0], 'readings' | 'linked'> {
    if (row.kind === 'crawler') {
      const reading = crawlerOf.get(row.serverId)
      return reading ? { readings: crawlerVitals(reading) } : {}
    }
    if (row.kind !== 'pilot') return {}
    const seat = seatOf.get(row.serverId)
    if (!seat?.pilot) return {}
    const { mech, mechHref } = seat.pilot
    const live = vitals?.pilots.find((p) => p._id === row.serverId)
    const mechLive =
      live?.mechId == null
        ? undefined
        : vitals?.mechs.find((m) => (m.linkId ?? m._id) === live.mechId)
    return {
      ...(seat.hp === null ? {} : { readings: [{ label: 'HP', value: seat.hp }] }),
      // The mech the pilot is assigned, its header-only Mini opening its sheet,
      // never a chip, its live readings its chips;
      // on foot there is none.
      ...(mech === null
        ? {}
        : {
            linked: [
              {
                key: 'mech',
                kind: 'mech' as const,
                name: mech,
                href: mechHref ?? undefined,
                readings: mechLive
                  ? [
                      ...pool('SP', mechLive.currentSP, mechLive.maxSP),
                      ...pool('EP', mechLive.currentEP, mechLive.maxEP),
                      ...gauge('Heat', mechLive.currentHeat, mechLive.maxHeat),
                    ]
                  : [],
              },
            ],
          }),
    }
  }

  /**
   * A row's verbs about its place at this table, in its ⋯ menu: the Compact
   * itself opens the sheet in Build, where everything else about a unit is done.
   */
  function rowMenu(row: RosterRow): HeaderMenuItem[][] {
    const act = (run: () => void) => (busy ? undefined : run)
    const verbs: HeaderMenuItem[] = [
      { id: 'open', label: 'Open sheet', onSelect: () => go(rosterSheetHref(row)) },
    ]
    // Picking up is the SEAL's job, not a menu row's (`OwnerSeal`). Any owner
    // may hand back, not just the table runner: ADR-030 §4 makes ownership
    // voluntary outward, and the pick-up confirm promises this way back out.
    if (row.can.release) {
      verbs.push({
        id: 'offer',
        label: 'Offer to the crew',
        onSelect: act(() => rowActions.offer(row)),
      })
    }
    if (row.can.makePrimary) {
      verbs.push({
        id: 'primary',
        label: 'Make primary',
        onSelect: act(
          () =>
            void makePrimary.run({
              gameId: gameId as Id<'games'>,
              crawlerId: row.serverId as Id<'crawlers'>,
            })
        ),
      })
    }
    // The move out (ADR-037): your own pilot or mech, or (for the table
    // runner) a crawler, once this browser holds the copy the move is made on.
    if (row.can.removeFromGame && row.localId !== null) {
      verbs.push({
        id: 'remove',
        label: `Move to your ${PRODUCT.build}`,
        onSelect: act(() => rowActions.removeFromGame(row, gameName)),
      })
    }
    // Leaving the table's roster for good: your own build, or (for the table
    // runner) the crawler. Copying is Build's.
    const danger: HeaderMenuItem[] = []
    if (row.can.delete || row.can.scrap) {
      danger.push({
        id: 'delete',
        label: 'Delete…',
        tone: 'danger',
        onSelect: act(() => (row.can.delete ? rowActions.remove(row) : rowActions.scrap(row))),
      })
    }
    return [verbs, danger]
  }

  function renderRow(row: RosterRow): ReactNode {
    return (
      <li key={row.serverId} style={ITEM}>
        <UnitRow
          kind={row.kind}
          name={row.name}
          /* The primary crawler is where new crew is assigned (ADR-037), so
             the list says which one it is. */
          note={row.primary ? '★ Primary' : undefined}
          /* The Compact is the door to the live sheet in Build: editable when
             the row is yours to edit, read-only when it is a crewmate's. */
          mode={{ kind: 'link', href: rosterSheetHref(row) }}
          {...rowChips(row)}
          /* Who holds it sits right of the name, a label (ruleset §7.2):
             never a stamp riding the frame. */
          labels={
            row.owner === null ? undefined : (
              <OwnerSeal
                owner={row.owner}
                claimable={row.can.claim}
                disabled={busy}
                onClaim={() => rowActions.pickUp(row)}
              />
            )
          }
          trailing={
            <HeaderMenu
              variant="overflow"
              trigger={null}
              label={`More for ${row.name}`}
              sections={rowMenu(row)}
            />
          }
        />
      </li>
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
        title="Crew"
        {...(seats !== null && seats.total > 0
          ? { count: { label: 'Seats', value: seats.claimed, max: seats.total } }
          : {})}
        actions={
          <>
            {caps.canAddCrew && (
              <Button href={newInGameHref('/pilots/new', gameId)} variant="default" size="compact">
                + New Pilot
              </Button>
            )}
            {caps.canRaiseCrawler && !caps.hasCrawler && (
              <Button
                href={newInGameHref('/crawlers/new', gameId)}
                variant="default"
                size="compact"
              >
                + New Crawler
              </Button>
            )}
            <Button href="/" variant="default" size="compact">
              Manage in Build
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
          <RosterSkeleton label="the crew" />
        ) : rows.length === 0 ? (
          <Text variant="hint" style={HINT}>
            Nobody has brought a unit to this Game yet.
          </Text>
        ) : (
          <ul aria-labelledby="crew-heading" style={LIST}>
            {rows.map(renderRow)}
          </ul>
        )}
      </SlabSection>

      {confirmDialog}
    </>
  )
}
