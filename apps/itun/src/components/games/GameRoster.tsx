/**
 * GameRoster — a Game's crew, rendered as the Roster renders a shelf.
 *
 * ## Why this looks like the home page
 *
 * The Roster (`components/roster/Roster.tsx`) is the app's answer to "what have
 * I got and what can I do with it": three ontology-toned columns of
 * `EntityRow`s, a create CTA at the head of each, a Dashboard launch in the
 * header. A Game asks the same question of a different container, and the first
 * cut of the Game surfaces answered it in a different vocabulary entirely — a
 * vertical stack of bordered cards listing names and numbers, with no way in to
 * a sheet and no way to make anything. Two shapes for one question is how an
 * app stops feeling like one app.
 *
 * So this is the same shape, with the parts a shared table adds: an owner chip
 * on every row, a way to pick up what nobody holds, and creation gated by the
 * rules in `lib/games/gameRoster.ts`.
 *
 * ## Creation goes through the wizards, not through a form here
 *
 * A create CTA points this browser's **current container** at the Game and then
 * opens the ordinary wizard. Nothing about building a pilot changes because the
 * pilot is destined for a crew, and a second, thinner creation path would drift
 * from the real one immediately. The entity is stamped with the Game on write
 * (`entityStore.create`) and mirrored up from there.
 *
 * ## What a row opens
 *
 * Every row has one View, to the live sheet (`rosterSheetHref`). It opens
 * editable when the row is yours to edit — your own pilots and mechs, and the
 * communal crawler — and read-only and live when it is a crewmate's; the rule
 * is in `lib/games/gameRoster.ts` and the rendering in `SheetView`. Nothing is
 * fetched on the way in: what you may edit is already in this browser
 * (`ShelfSync` and `WiringSync` cache it), and what you may not is read from
 * the Game's listing and never cached.
 *
 * ## Every verb that changes who has a build asks first
 *
 * Pick up, Offer to the crew, Copy to shelf, Delete and Scrap each open one
 * shared confirm (`useConfirm`) that says what will happen and whether it can be
 * undone, and do nothing until the player confirms. The verbs and their words
 * live outside this file — `useRowActions` and `lib/games/rowActionCopy.ts` —
 * so any other surface listing these rows offers the same consequences.
 */

import { useRouter } from '@tanstack/react-router'
import { Button, buttonVariants, cn, EmptyState, EntityRow, PageHeading, Text } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import { Bot, UserRound, Warehouse } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useCrawlers, useHydrateEntities, useMechs, usePilots } from '../../hooks/entities'
import type { RosterKind, RosterRow } from '../../lib/games/gameRoster'
import {
  crawlerRows,
  ownableRows,
  rosterSheetHref,
  tableCapabilities,
} from '../../lib/games/gameRoster'
import { rosterRowStats } from '../../lib/games/rosterRowStats'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { setActiveContainer } from '../../stores/activeContainerStore'
import { AppLink } from '../shared/AppLink'
import { ConvexPending } from '../shared/ConvexPending'
import { useConfirm } from '../shared/useConfirm'
import { OwnerSeal } from './OwnerSeal'
import { useRowActions } from './useRowActions'

type GameRosterProps = {
  gameId: string
  /** Shown above the columns; the Game's name, when the caller knows it. */
  gameName?: string
}

/** The three columns, in the build order the app teaches everywhere else. */
const COLUMNS: ReadonlyArray<{
  kind: RosterKind
  title: string
  createHref: string
  createLabel: string
  empty: string
}> = [
  {
    kind: 'pilot',
    title: 'Pilots',
    createHref: '/pilots/new',
    createLabel: 'Create Pilot',
    empty: 'No pilots in this game yet.',
  },
  {
    kind: 'mech',
    title: 'Mechs',
    createHref: '/mechs/new',
    createLabel: 'Create Mech',
    empty: 'No mechs in this game yet.',
  },
  {
    kind: 'crawler',
    title: 'Crawlers',
    createHref: '/crawlers/new',
    createLabel: 'Raise a Crawler',
    empty: 'No Union Crawler yet.',
  },
]

const ICON: Record<RosterKind, typeof UserRound> = {
  pilot: UserRound,
  mech: Bot,
  crawler: Warehouse,
}

const TONE_TEXT: Record<RosterKind, string> = {
  pilot: 'text-sheet-pilot-deep',
  mech: 'text-sheet-mech-deep',
  crawler: 'text-sheet-crawler-deep',
}

export function GameRoster({ gameId, gameName }: GameRosterProps) {
  // Probed rather than required, the way `AppLink` and `DashboardChooser` do:
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

  async function launchDashboard(row: RosterRow) {
    // Your own mech is in this browser already — `ShelfSync` caches everything
    // you own — so there is nothing to fetch; a mech still on its way in has
    // not arrived yet, and says so.
    if (row.localId === null) throw new Error('That mech has not reached this browser yet.')
    await router?.navigate({ to: '/dashboard/$id', params: { id: row.localId } })
  }

  /**
   * Point this browser at the Game on the way into the wizard.
   *
   * Rendered as a link with a side effect rather than a button that navigates:
   * `entityStore.create` stamps whatever container is current, so the container
   * has to change BEFORE the wizard's create call — and going through `AppLink`
   * keeps the CTA a real anchor (middle-click, open-in-new-tab, and the
   * router-less fallback the component tests rely on).
   */
  function enterGameContainer() {
    setActiveContainer({ kind: 'game', gameId })
  }

  const loading = listing === undefined || members === undefined

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-4">
        <div>
          {/* An h2, so the columns' h3s sit under something. The page reads
              h1 (Game) → h2 (the crew, the panels) → h3 (Pilots / Mechs /
              Crawlers); as a div it skipped a level and left the columns
              parented by nothing. */}
          <PageHeading variant="subheading">{gameName ?? 'The crew'}</PageHeading>
          <Text variant="hint" className="text-left">
            {caps.tableRunner
              ? 'You run this table: raise its crawler, and build characters for the crew to pick up.'
              : 'Everything the crew has brought to this game. Pick up anything nobody holds.'}
          </Text>
        </div>
      </div>

      {error !== null && (
        <Text variant="hint" className="text-left text-[var(--color-roll-cascade)]">
          {error}
        </Text>
      )}

      {!caps.canAddCrew && caps.addCrewBlocked !== null && (
        <Text variant="hint" className="text-left">
          {caps.addCrewBlocked}
        </Text>
      )}

      {loading ? (
        <ConvexPending label="the crew" />
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {COLUMNS.map((column) => {
            const Icon = ICON[column.kind]
            const columnRows = rows[column.kind]
            // The crawler column answers to the table runner (`createCrawler`);
            // the other two to membership (`assertMayAddToContainer`).
            const mayCreate =
              column.kind === 'crawler'
                ? caps.canRaiseCrawler
                : caps.canAddCrew && viewerId !== null

            return (
              <div key={column.kind}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <PageHeading variant="section" as="h3" className="text-rust">
                    {column.title}
                  </PageHeading>
                  {mayCreate && columnRows.length > 0 && (
                    <AppLink
                      href={column.createHref}
                      onClick={enterGameContainer}
                      className={cn(
                        buttonVariants({ variant: 'default', size: 'compact' }),
                        'no-underline'
                      )}
                    >
                      + {column.createLabel}
                    </AppLink>
                  )}
                </div>

                {columnRows.length === 0 ? (
                  <EmptyState
                    variant="quiet"
                    body={
                      column.kind === 'crawler' && !caps.canRaiseCrawler
                        ? 'No Union Crawler yet — the Mediator raises one.'
                        : column.empty
                    }
                    icon={<Icon className={cn('size-7', TONE_TEXT[column.kind])} />}
                    action={
                      mayCreate ? (
                        <AppLink
                          href={column.createHref}
                          onClick={enterGameContainer}
                          className={cn(
                            buttonVariants({ variant: 'primary', size: 'compact' }),
                            'no-underline'
                          )}
                        >
                          {column.createLabel}
                        </AppLink>
                      ) : undefined
                    }
                  />
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {columnRows.map((row) => (
                      <li key={row.serverId} className="list-none">
                        <EntityRow
                          entityType={row.kind}
                          name={row.name}
                          stats={rosterRowStats(row)}
                          linkAs={AppLink}
                          /* Every row is a door, and there is one: View, to
                             the live sheet — editable when the row is yours
                             to edit (`row.can.openSheet`), read-only when it
                             is a crewmate's (`SheetView`). */
                          sheetHref={rosterSheetHref(row)}
                          /* The primary crawler is where new crew is assigned
                             (ADR-037), so the roster says which one it is. */
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
                              {row.kind === 'mech' && row.can.openSheet && (
                                <Button
                                  variant="primary"
                                  size="mini"
                                  disabled={busy !== null}
                                  onClick={() =>
                                    void run(`dash-${row.serverId}`, () => launchDashboard(row))
                                  }
                                >
                                  Dashboard
                                </Button>
                              )}
                              {/* Picking up is the SEAL's job, not a button's —
                                  see `OwnerSeal`. Any owner, not just the table runner: ADR-030
                                  §4 says ownership is voluntary in the outward
                                  direction, and the pick-up confirm promises
                                  exactly this as the way back out. */}
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
                              {/* Pilots and mechs only. Copying the crawler is a
                                  product choice nobody has made yet, not an
                                  impossibility: a crawler shelves like anything
                                  else now, but it is the crew's shared home
                                  rather than a character somebody keeps, so
                                  "take your own copy of the table's crawler"
                                  wants a decision before it gets a button. */}
                              {row.kind !== 'crawler' && (
                                <Button
                                  variant="ghost"
                                  size="mini"
                                  disabled={busy !== null}
                                  onClick={() => rowActions.copy(row)}
                                >
                                  Copy to shelf
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
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="font-body text-xs text-wk-muted">
        What you can edit opens to edit; a crewmate&rsquo;s pilot or mech opens read-only, as it
        stands right now.{' '}
        <AppLink href="/" className={cn(buttonVariants({ variant: 'ghost', size: 'mini' }))}>
          Back to your builds
        </AppLink>
      </p>

      {confirmDialog}
    </section>
  )
}
