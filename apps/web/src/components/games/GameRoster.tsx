/**
 * GameRoster — a Game's crew, in the hub's three columns.
 *
 * ## Why this looks like Shelves
 *
 * `/` shows one container at a time (`Roster`): Shelves, or a Game picked in
 * its Games select. Both ask "what have we got and what can I do with it",
 * so both answer in the same three ontology-toned columns of Rows (`UnitRow`)
 * (`roster/RosterColumn.tsx`). A Game adds what a shared table needs: an owner
 * seal on every row, a way to pick up what nobody holds, and creation gated by
 * the rules in `lib/games/gameRoster.ts`.
 *
 * ## Yours first
 *
 * Each column lists **your** pilots or mechs first, then everybody else's —
 * the crewmates' (their name on the seal) and the unclaimed ones (an UNCLAIMED
 * seal you press to pick it up). The seal says whose a row is, so the list needs
 * no group headings. A crawler is the crew's, owned by nobody, so the ★ Primary
 * leads its column (`groupColumn`).
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
 * Every row is a link to the live sheet (`rosterSheetHref`), its other verbs
 * in a ⋯ menu, its last chip, as a shelf item's (`ShelfItem`). A row's only
 * other chip is who holds it (and ★ Primary on the crawler): what a unit IS
 * is on its sheet, and the crew's state is in Crew & seats. The sheet opens
 * editable when the row is yours to edit — your own pilots and mechs, and the
 * crawler when you run the table (ADR-038 §5) — and read-only and live
 * otherwise; `entities.locate` decides and `SheetView` renders it. No row
 * launches the Dashboard: that is the Game band's Launch Dashboard chip
 * (`LaunchDashboard`, ADR-038 §1).
 *
 * ## Every verb that changes who has a build asks first
 *
 * Pick up, Offer to the crew, Make a copy, Remove from Game, Delete and
 * Scrap each open one shared confirm (`useConfirm`) that says what will happen
 * and whether it can be undone, and do nothing until the player confirms. The
 * verbs and their words live outside this file — `useRowActions` and
 * `lib/games/rowActionCopy.ts` — so every surface offering them says the same.
 */

import type { Crawler } from 'cantina-domain/schemas/crawler'
import type { Mech } from 'cantina-domain/schemas/mech'
import type { Pilot } from 'cantina-domain/schemas/pilot'
import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties, ReactNode } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useServerAction } from '../../lib/connection/useServerAction'
import { useCrawlers, useHydrateEntities, useMechs, usePilots } from '../../lib/entities'
import type { RosterKind, RosterRow } from '../../lib/games/gameRoster'
import {
  crawlerRows,
  groupColumn,
  ownableRows,
  rosterSheetHref,
  tableCapabilities,
} from '../../lib/games/gameRoster'
import type { HeaderMenuItem } from '../index'
import { buttonVariants, FieldError, HeaderMenu, RosterSkeleton, Text, tokens } from '../index'
import type { ColumnCreate, SegmentKind } from '../roster/RosterColumn'
import { RosterColumn, RosterGrid, RosterList, SegmentSwitch } from '../roster/RosterColumn'
import { AppLink } from '../shared/AppLink'
import { UnitRow } from '../shared/UnitRow'
import { useConfirm } from '../shared/useConfirm'
import { useGo } from '../shared/useGo'
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
    empty: 'No pilots in this Game yet.',
  },
  {
    kind: 'mech',
    title: 'Mechs',
    create: { href: '/mechs/new', label: 'Create Mech' },
    empty: 'No mechs in this Game yet.',
  },
  {
    kind: 'crawler',
    title: 'Crawlers',
    create: { href: '/crawlers/new', label: 'Raise a Crawler' },
    empty: 'No Union Crawler yet.',
  },
]

const HINT = { marginTop: tokens.space[16], textAlign: 'left' } satisfies CSSProperties

const ITEM = { listStyle: 'none', minWidth: 0 } satisfies CSSProperties

const PATTERNS_LINK = { textDecoration: 'none' } satisfies CSSProperties

export function GameRoster({ gameId, gameName, activeSegment, onSegmentChange }: GameRosterProps) {
  // One confirm for every row verb; see `useRowActions`.
  const { confirm, dialog: confirmDialog } = useConfirm()
  const rowActions = useRowActions(confirm)
  const go = useGo()

  const me = useQuery(api.account.me, {})
  const members = useQuery(api.games.members, { gameId: gameId as Id<'games'> })
  const listing = useQuery(api.entities.listForGame, { gameId: gameId as Id<'games'> })

  const makePrimary = useServerAction(useMutation(api.games.setPrimaryCrawler), {
    failure: 'That crawler could not be made primary. Try again.',
  })
  const busy = makePrimary.pending
  const error = makePrimary.error

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

  /**
   * A row's verbs, in its ⋯ menu as a shelf item's are (Shelves): the Row
   * itself opens the sheet, so its band carries only its name and chips.
   */
  function rowMenu(row: RosterRow): HeaderMenuItem[][] {
    const act = (run: () => void) => (busy ? undefined : run)
    const verbs: HeaderMenuItem[] = [
      { id: 'open', label: 'Open', onSelect: () => go(rosterSheetHref(row)) },
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
    // Pilots and mechs only: copying the crawler, the crew's shared home, is
    // a product choice nobody has made yet.
    if (row.kind !== 'crawler') {
      verbs.push({ id: 'copy', label: 'Make a copy', onSelect: act(() => rowActions.copy(row)) })
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
        label: 'Remove from Game',
        onSelect: act(() => rowActions.removeFromGame(row, gameName)),
      })
    }
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
             the roster says which one it is. */
          note={row.primary ? '★ Primary' : undefined}
          /* The Row is the door to the live sheet: editable when the row is
             yours to edit (`row.can.openSheet`), read-only when it is a
             crewmate's (`SheetView`). */
          mode={{ kind: 'link', href: rosterSheetHref(row) }}
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

  /** A column's body: your rows first, then everyone else's, in one list. */
  function columnBody(columnRows: readonly RosterRow[]): ReactNode {
    const { yours, others } = groupColumn(columnRows)
    return <RosterList>{[...yours, ...others].map(renderRow)}</RosterList>
  }

  const loading = listing === undefined || members === undefined

  return (
    <>
      {error !== null && (
        <div style={HINT}>
          <FieldError>{error}</FieldError>
        </div>
      )}

      {!caps.canAddCrew && caps.addCrewBlocked !== null && !loading && (
        <Text variant="hint" style={HINT}>
          {caps.addCrewBlocked}
        </Text>
      )}

      {loading ? (
        <RosterSkeleton label="the crew" />
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
                        className={buttonVariants({ variant: 'ghost', size: 'mini' })}
                        style={PATTERNS_LINK}
                      >
                        Patterns
                      </AppLink>
                    ) : undefined
                  }
                  empty={columnRows.length === 0}
                >
                  {columnBody(columnRows)}
                </RosterColumn>
              )
            })}
          </RosterGrid>
        </>
      )}

      {confirmDialog}
    </>
  )
}
