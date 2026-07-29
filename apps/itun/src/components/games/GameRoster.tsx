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
 * ## What a row will and will not open
 *
 * Only what you own offers a sheet, and the reasoning is in
 * `lib/games/gameRoster.ts` — ITUN's sheet is a live editing surface, so
 * opening a crewmate's would hand you an editor the server then refuses. The
 * crawler is the exception because it is genuinely communal.
 *
 * Rows you may open but have never held locally are **adopted on the way in**:
 * the server body is cached into IndexedDB under its own id, which is what
 * makes the sheet and the Dashboard work at all for a character built at
 * somebody else's table.
 */

import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Bot, UserRound, Warehouse } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import {
  Badge,
  Button,
  buttonVariants,
  EmptyState,
  EntityRow,
  ModalShell,
  Text,
} from 'component-lib'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useCrawlers, useHydrateEntities, useMechs, usePilots } from '../../hooks/queries'
import { resolveClassName } from '../../lib/classRef'
import {
  crawlerRows,
  ownableRows,
  tableCapabilities,
  type RosterRow,
  type RosterKind,
} from '../../lib/games/gameRoster'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { setActiveContainer } from '../../stores/activeContainerStore'
import { useEntityStore } from '../../stores/entityStore'
import { cn } from '../../lib/utils'
import { AppLink } from '../shared/AppLink'
import { SECTION } from './gameChrome'

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

/** Vitals for the row's stat strip. Absent numbers are omitted, never zeroed. */
function statsFor(row: RosterRow): Array<{ label: string; value: string | number }> {
  const num = (key: string): number | undefined => {
    const value = row.body[key]
    return typeof value === 'number' ? value : undefined
  }
  const out: Array<{ label: string; value: string | number }> = []

  if (row.kind === 'pilot') {
    if (num('currentHP') !== undefined) out.push({ label: 'HP', value: num('currentHP') as number })
    if (num('currentAP') !== undefined) out.push({ label: 'AP', value: num('currentAP') as number })
  }
  if (row.kind === 'mech') {
    if (num('currentSP') !== undefined) out.push({ label: 'SP', value: num('currentSP') as number })
    if (num('currentHeat') !== undefined) {
      out.push({ label: 'Heat', value: num('currentHeat') as number })
    }
  }
  if (row.kind === 'crawler') {
    const tl = String(row.body.techLevel ?? '').replace(/[^0-9]/g, '')
    if (tl) out.push({ label: 'TL', value: tl })
    const bays = Array.isArray(row.body.crawlerBays) ? row.body.crawlerBays.length : 0
    out.push({ label: 'Bays', value: bays })
  }
  return out
}

/** The muted caption under the name: callsign / chassis, then the owner chip. */
function metaLineFor(row: RosterRow) {
  const parts: string[] = []
  if (row.kind === 'pilot') {
    const callsign = row.body.callsign
    if (typeof callsign === 'string' && callsign.length > 0 && callsign !== row.name) {
      parts.push(`"${callsign}"`)
    }
    const className = resolveClassName(String(row.body.classRef ?? ''))
    if (className) parts.push(className)
  }
  if (row.kind === 'mech') {
    const chassis = row.body.chassisRef
    if (typeof chassis === 'string' && chassis.length > 0) parts.push(chassis)
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {parts.length > 0 && <span>{parts.join(' · ')}</span>}
      {/* Ownership is a STATE, not a blank (ADR-030 D32). An UNCLAIMED row
          carries its state as a stamp seal in the row's trailing controls
          instead of a chip here — see `UnclaimedSeal`. */}
      {row.owner !== null && !row.owner.unclaimed && (
        <Badge shape="chip" surface="tone" tone={row.kind} className="max-w-full truncate">
          {row.owner.label}
        </Badge>
      )}
    </span>
  )
}

/**
 * The UNCLAIMED seal: a stamped mark on the right of the row, and the way in
 * to picking that character up.
 *
 * It is one control rather than a chip plus a button because it is one fact.
 * An unclaimed pre-gen is an *offer*, so the thing that announces it should
 * also be the thing you press — a row that read "Unclaimed" in muted grey next
 * to a separate "Pick up" said the same thing twice and buried the invitation
 * in the quieter half.
 *
 * Stamped rather than chipped for the same reason a document is stamped: it is
 * a mark applied ON the record about its status, not a property of the
 * character. It opens a confirm rather than claiming outright — taking a
 * character is a commitment at the table, and the modal is where the surface
 * says what happens next (it becomes yours, and it lands in this browser).
 */
function UnclaimedSeal({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Unclaimed — pick this up"
      className={cn(
        'rotate-[-4deg] cursor-pointer border-0 bg-transparent p-0',
        'transition-transform duration-200 hover:rotate-0 disabled:cursor-default disabled:opacity-50'
      )}
    >
      <Badge shape="stamp" size="compact" surface="inverse" className="tracking-caps-wide">
        Unclaimed
      </Badge>
    </button>
  )
}

export function GameRoster({ gameId, gameName }: GameRosterProps) {
  // Probed rather than required, the way `AppLink` and `DashboardChooser` do:
  // component tests render these surfaces without a RouterProvider, and a hook
  // that throws on a missing context would make the whole screen untestable.
  const router = useRouter({ warn: false })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** The row whose UNCLAIMED seal was pressed, awaiting confirmation. */
  const [claimTarget, setClaimTarget] = useState<RosterRow | null>(null)

  const me = useQuery(api.account.me, {})
  const members = useQuery(api.games.members, { gameId: gameId as Id<'games'> })
  const listing = useQuery(api.entities.listForGame, { gameId: gameId as Id<'games'> })

  const claim = useMutation(api.ownership.claim)
  const release = useMutation(api.ownership.release)
  const scrapCrawler = useMutation(api.entities.removeCrawler)

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
    }),
  }

  /**
   * Make sure this browser holds the row, then hand back the id a sheet route
   * takes. Adoption keeps the entity's own id, so the copy IS the entity rather
   * than a fork of it — see `entityStore.adopt`.
   */
  async function ensureLocal(row: RosterRow): Promise<string | null> {
    const id = row.body.id
    if (typeof id !== 'string' || id.length === 0) return row.localId
    // Adopted even when a copy is already here: the server is the source of
    // record, and the copy may be stale — most obviously for the crawler, which
    // the whole crew edits. Overwriting is safe because every local write
    // mirrors up immediately, so a local copy is never legitimately ahead.
    await useEntityStore.getState().adopt(row.kind, row.body as never)
    return id
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

  async function openSheet(row: RosterRow) {
    const localId = await ensureLocal(row)
    if (localId === null) {
      throw new Error('That build has not been saved anywhere this browser can open yet.')
    }
    await router?.navigate({ to: '/sheet/$kind/$id', params: { kind: row.kind, id: localId } })
  }

  async function launchDashboard(row: RosterRow) {
    const localId = await ensureLocal(row)
    if (localId === null) throw new Error('That mech cannot be launched from this browser yet.')
    await router?.navigate({ to: '/dashboard/$id', params: { id: localId } })
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
          <Text as="div" className={SECTION}>
            {gameName ?? 'The crew'}
          </Text>
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
        <Text variant="hint">Loading the crew…</Text>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {COLUMNS.map((column) => {
            const Icon = ICON[column.kind]
            const columnRows = rows[column.kind]
            // The crawler column answers to the table runner; the other two to
            // the crawler gate. Both mirror `assertMayAddToContainer`.
            const mayCreate =
              column.kind === 'crawler'
                ? caps.canRaiseCrawler
                : caps.canAddCrew && viewerId !== null

            return (
              <div key={column.kind}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-cond text-base font-bold uppercase tracking-widest text-rust">
                    {column.title}
                  </h3>
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
                          stats={statsFor(row)}
                          metaLine={metaLineFor(row)}
                          linkAs={AppLink}
                          actions={
                            <>
                              {row.can.openSheet && (
                                <Button
                                  variant="default"
                                  size="compact"
                                  disabled={busy !== null}
                                  onClick={() =>
                                    void run(`open-${row.serverId}`, () => openSheet(row))
                                  }
                                >
                                  Sheet
                                </Button>
                              )}
                              {row.kind === 'mech' && row.can.openSheet && (
                                <Button
                                  variant="primary"
                                  size="compact"
                                  disabled={busy !== null}
                                  onClick={() =>
                                    void run(`dash-${row.serverId}`, () => launchDashboard(row))
                                  }
                                >
                                  Dashboard
                                </Button>
                              )}
                              {row.can.claim && (
                                <UnclaimedSeal
                                  disabled={busy !== null}
                                  onClick={() => setClaimTarget(row)}
                                />
                              )}
                              {/* Any owner, not just the table runner: ADR-030
                                  §4 says ownership is voluntary in the outward
                                  direction, and the pick-up confirm promises
                                  exactly this as the way back out. */}
                              {row.can.release && (
                                <Button
                                  variant="ghost"
                                  size="compact"
                                  disabled={busy !== null}
                                  onClick={() =>
                                    void run(`offer-${row.serverId}`, async () => {
                                      await release({
                                        table: row.kind === 'pilot' ? 'pilots' : 'mechs',
                                        entityId: row.serverId,
                                      })
                                      // It belongs to the table now, not to this
                                      // browser: keeping a local copy would leave
                                      // an editor whose writes the server refuses.
                                      if (row.localId !== null) {
                                        await useEntityStore
                                          .getState()
                                          .forget(row.kind, row.localId)
                                      }
                                    })
                                  }
                                >
                                  Offer to the crew
                                </Button>
                              )}
                              {row.can.scrap && (
                                <Button
                                  variant="ghost"
                                  size="compact"
                                  disabled={busy !== null}
                                  onClick={() =>
                                    void run(`scrap-${row.serverId}`, async () => {
                                      await scrapCrawler({
                                        crawlerId: row.serverId as Id<'crawlers'>,
                                      })
                                      if (row.localId !== null) {
                                        await useEntityStore
                                          .getState()
                                          .forget('crawler', row.localId)
                                      }
                                    })
                                  }
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
        Sheets you open from here are cached in this browser and saved back to the game.{' '}
        <AppLink href="/" className={cn(buttonVariants({ variant: 'ghost', size: 'mini' }))}>
          Back to your builds
        </AppLink>
      </p>

      {/* Picking a character up is constructive, not destructive, so this is an
          `action`-toned confirm rather than the danger one the delete flows use.
          It exists to say what happens next — it becomes yours, and it lands in
          this browser — which the seal alone cannot. */}
      <ModalShell
        open={claimTarget !== null}
        onOpenChange={(next) => {
          if (!next) setClaimTarget(null)
        }}
        title={`Pick up ${claimTarget?.name ?? ''}?`}
        tone="action"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          <div className="font-body text-sm text-wk-muted">
            {claimTarget?.name ?? 'This character'} is unclaimed — the Mediator left them for
            somebody to take. Picking them up makes you their owner: they become yours to edit, they
            open in this browser, and every change saves back to the game.
          </div>
          <div className="font-body text-xs text-wk-muted">
            Changed your mind later? Hand them back with “Offer to the crew”.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="compact" onClick={() => setClaimTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="compact"
              disabled={busy !== null}
              onClick={() => {
                const row = claimTarget
                if (row === null) return
                void run(`claim-${row.serverId}`, async () => {
                  await claim({
                    table: row.kind === 'pilot' ? 'pilots' : 'mechs',
                    entityId: row.serverId,
                  })
                  // Pull it down so it opens straight away — picking something
                  // up and then having nowhere to open it would be half a verb.
                  await ensureLocal(row)
                  setClaimTarget(null)
                })
              }}
            >
              Pick up
            </Button>
          </div>
        </div>
      </ModalShell>
    </section>
  )
}
