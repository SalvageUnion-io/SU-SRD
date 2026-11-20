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
 * runner's **+ New Crawler** while the Game has none. Moving a unit in or out
 * is its ⋯ menu's, in the Training Bay, one tab away (ADR-066).
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
import type { OpenColumn, OpenRow } from '../../build/dash/OpenLedger'
import { OpenLedger, TechLevel } from '../../build/dash/OpenLedger'
import type { HeaderMenuItem } from '../../components/index'
import {
  Button,
  FieldError,
  HeaderMenu,
  RosterSkeleton,
  SlabSection,
  Stat,
  Text,
} from '../../components/index'
import type { UnitRow } from '../../components/shared/UnitRow'
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
import { techLevelReading, VITAL } from '../../lib/units/readings'
import { newInGameHref } from '../../lib/wizard/fromGame'
import { playGamesCopy } from '../../messages/play-games'
import { useGameListing } from '../../replica/gameListing'
import { useGamesCall, useViewerId } from '../../replica/roomCalls'
import { useTableRead } from '../../replica/useTable'
import { crawlerVitals, readCrawler } from './crawlerReading.model'
import { OwnerSeal } from './OwnerSeal'
import type { SeatRow } from './seatRows.model'
import { seatRows } from './seatRows.model'
import { useRowActions } from './useRowActions'

/**
 * A pilot's face on the roster (E10, C11): their photo, else their Class's
 * art, and their Class as a relation chip. Other rows draw as they were.
 */
type GameRosterProps = {
  gameId: string
  /** The Game's name, for the confirms that name it; null while unknown. */
  gameName: string | null
}

/**
 * MOCK (best, revision 3): `?crew=mock` fills the seeded Game's Crew with a
 * table's worth of rows so the page shows its real density. The units are the
 * Starter Set's own (their figures as its sheets print them); the member
 * names are placeholders. Display only: nothing is written anywhere.
 */
const MOCK_CREW =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('crew') === 'mock'

function mockCrew(kind: 'pilot' | 'crawler'): OpenRow[] {
  if (!MOCK_CREW) return []
  const pilot = (
    name: string,
    mech: string,
    who: string,
    hp: string,
    sp: string,
    ep: string,
    heat: string
  ): OpenRow => ({
    id: `mock-${name}`,
    name,
    meta: `in ${mech}`,
    cells: [who, <TechLevel key="tl" level="1" />, hp, sp, ep, heat],
  })
  return kind === 'pilot'
    ? [
        pilot('Pickle', 'Spectrum', 'Player two', '8/10', '17/17', '9/11', '1/3'),
        pilot('Judge', 'Mule', 'Player three', '10/10', '9/12', '4/4', '0/6'),
        pilot('Hotdog', 'Mazona', 'Player four', '6/10', '5/5', '10/10', '3/6'),
        pilot('Razor', 'Thresher', 'Unclaimed', '10/10', '15/15', '6/6', '0/10'),
      ]
    : [
        {
          id: 'mock-tenacity',
          name: "Crawler #430 'Tenacity'",
          cells: ['Crew', <TechLevel key="tl" level="1" />, '', '20/20', '', ''],
        },
      ]
}

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
   * A row's readings and linked units: a pilot's seat (HP, its mech), a
   * crawler's vitals, a mech's Tech Level; an assigned mech or crawler always
   * shows its TL.
   */
  function rowChips(row: RosterRow): Pick<Parameters<typeof UnitRow>[0], 'readings' | 'linked'> {
    if (row.kind === 'crawler') {
      const reading = crawlerOf.get(row.serverId)
      return reading ? { readings: crawlerVitals(reading) } : {}
    }
    if (row.kind === 'mech') {
      // A mech on its own row reads its vitals as one
      // riding its pilot's row does, in the same order: TL, SP, EP, Heat.
      const live = vitals?.mechs.find((m) => m._id === row.serverId)
      return live == null
        ? {}
        : {
            readings: [
              ...techLevelReading(live.techLevel),
              ...pool(VITAL.sp, live.currentSP, live.maxSP),
              ...pool(VITAL.ep, live.currentEP, live.maxEP),
              ...gauge(VITAL.heat, live.currentHeat, live.maxHeat),
            ],
          }
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
      ...(seat.hp === null ? {} : { readings: [{ label: playGamesCopy('hp'), value: seat.hp }] }),
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
                      ...techLevelReading(mechLive.techLevel),
                      ...pool(VITAL.sp, mechLive.currentSP, mechLive.maxSP),
                      ...pool(VITAL.ep, mechLive.currentEP, mechLive.maxEP),
                      ...gauge(VITAL.heat, mechLive.currentHeat, mechLive.maxHeat),
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

  // MOCK (density mock, sheet variant): the crew as ONE manifest, a line a
  // unit under the columns the table reads — who holds it, and the numbers
  // Play spends. Its ⋯ menu rides the row, as a Compact's does.
  const MANIFEST: readonly OpenColumn[] = [
    // MOCK (revision 3): a phone drops Member so HP and SP never clip.
    { key: 'who', label: playGamesCopy('member'), kind: 'text' },
    { key: 'tl', label: 'TL', title: 'Tech Level' },
    { key: 'hp', label: 'HP', phone: true },
    { key: 'sp', label: 'SP', phone: true },
    { key: 'ep', label: 'EP' },
    { key: 'heat', label: 'Heat' },
  ]
  const readingOf = (
    chips: Pick<Parameters<typeof UnitRow>[0], 'readings' | 'linked'>,
    label: string
  ) => chips.readings?.find((reading) => reading.label === label)?.value ?? ''
  function manifestRow(row: RosterRow): OpenRow {
    const chips = rowChips(row)
    const linked = chips.linked?.[0]
    const mech = linked?.readings ?? []
    const mechOf = (label: string) => mech.find((reading) => reading.label === label)?.value ?? ''
    const tl = readingOf(chips, 'TL') || mechOf('TL')
    return {
      id: row.serverId,
      name: row.name,
      href: rosterSheetHref(row),
      meta: linked?.name ? `in ${linked.name}` : undefined,
      state: (
        <>
          {row.primary && <Stat size="mini" label={playGamesCopy('primary')} />}
          {row.owner !== null && (row.owner.unassigned || row.owner.mine) && (
            <OwnerSeal
              owner={row.owner}
              assignable={row.can.assignSelf}
              disabled={busy}
              onAssign={() => rowActions.assignSelf(row)}
            />
          )}
          <HeaderMenu
            variant="overflow"
            trigger={null}
            label={playGamesCopy('moreFor', { name: row.name })}
            sections={rowMenu(row)}
          />
        </>
      ),
      cells: [
        row.kind === 'crawler' ? playGamesCopy('crawlerGroup') : (row.owner?.label ?? ''),
        tl === '' ? '' : <TechLevel key="tl" level={tl} />,
        readingOf(chips, 'HP'),
        readingOf(chips, 'SP') || mechOf('SP'),
        readingOf(chips, 'EP') || mechOf('EP'),
        readingOf(chips, 'Heat') || mechOf('Heat'),
      ],
    }
  }

  /** Each kind's rows, yours first, then everyone else's. */
  const ordered = (rows: readonly RosterRow[]) => {
    const { yours, others } = groupColumn(rows)
    return [...yours, ...others]
  }
  const loading = listing === undefined || members === undefined

  const newButtons = (
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
        <Button href={newInGameHref('/crawlers/new', gameId)} variant="default" size="compact">
          {playGamesCopy('newCrawler')}
        </Button>
      )}
    </>
  )
  const note =
    error !== null ? (
      <FieldError>{error}</FieldError>
    ) : !caps.canAddCrew && caps.addCrewBlocked !== null && !loading ? (
      <Text variant="hint">{caps.addCrewBlocked}</Text>
    ) : undefined

  return (
    <>
      {loading ? (
        <SlabSection as="h2" id="crew-heading" title={playGamesCopy('crew')} actions={newButtons}>
          <RosterSkeleton label={playGamesCopy('theCrew')} />
        </SlabSection>
      ) : (
        // MOCK (density mock, sheet variant): the crew manifest IS the section
        // — its head is the label on the rule, with the seats on it and the
        // column labels at its end, so the "+ New…" buttons sit on their own
        // line under the rule rather than between the two (the page's one rust
        // button stays the band's).
        <OpenLedger
          as="h2"
          title={playGamesCopy('crew')}
          {...(seats !== null && seats.total > 0
            ? {
                tally: {
                  label: playGamesCopy('seats'),
                  value: seats.claimed,
                  max: seats.total,
                },
              }
            : {})}
          lead={
            <div className="su-open__controls">
              {newButtons}
              {note}
            </div>
          }
          columns={MANIFEST}
          groups={[
            { key: 'pilots', rows: [...ordered(pilots).map(manifestRow), ...mockCrew('pilot')] },
            {
              key: 'mechs',
              label: playGamesCopy('mechsGroup'),
              rows: ordered(mechs).map(manifestRow),
            },
            {
              key: 'crawlers',
              label: playGamesCopy('crawlerGroup'),
              rows: [...ordered(crawlers).map(manifestRow), ...mockCrew('crawler')],
            },
          ]}
          empty={playGamesCopy('nobodyHasBroughtAUnit')}
        />
      )}

      {confirmDialog}
    </>
  )
}
