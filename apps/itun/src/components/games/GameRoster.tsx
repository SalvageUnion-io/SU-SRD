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
import { resolveChassisRef } from 'salvageunion-reference/rules'
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
import type { OwnerChip } from '../../lib/ownership/ownerChip'
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

/**
 * Everything the row states as `label | value`, all of it in the header band.
 *
 * There is no second place for these any more: a stat is a stat whether it is a
 * number or a name, so `CLASS | Salvager` sits in the band beside `SP | 12`
 * rather than in a separate register below it. The body is left to the verbs.
 *
 * **HP and AP are deliberately absent.** A roster answers "what have I got",
 * not "how hurt is it": live vitals belong to the sheet and the Dashboard, and
 * a number that changes every round is stale on a listing the moment it renders.
 * Absent numbers are omitted, never zeroed.
 */
function statsFor(row: RosterRow): Array<{ label: string; value: string | number }> {
  const num = (key: string): number | undefined => {
    const value = row.body[key]
    return typeof value === 'number' ? value : undefined
  }
  const out: Array<{ label: string; value: string | number }> = []

  if (row.kind === 'pilot') {
    // What the pilot IS — the class leads, the callsign names them.
    const className = resolveClassName(String(row.body.classRef ?? ''))
    if (className) out.push({ label: 'Class', value: className })
    const callsign = row.body.callsign
    if (typeof callsign === 'string' && callsign.length > 0 && callsign !== row.name) {
      out.push({ label: 'Callsign', value: callsign })
    }
  }
  if (row.kind === 'mech') {
    // The chassis leads: it is what the mech IS, where SP and Heat are how it
    // is doing. Rendered as `CHASSIS | Iron Mongrel` rather than a bare chip,
    // so the name arrives labelled.
    const chassis = row.body.chassisRef
    if (typeof chassis === 'string' && chassis.length > 0) {
      const resolved = chassisOf(chassis)
      out.push({ label: 'Chassis', value: resolved.name })
      // TL is its own stat rather than a suffix on the chassis value: two facts
      // crammed into one value box is the thing `Stat` exists to stop.
      if (resolved.techLevel != null) out.push({ label: 'TL', value: resolved.techLevel })
    }
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

/**
 * A mech's chassis, resolved. The stored value is a SLUG, and printing the slug
 * is the surface admitting it never looked the chassis up — the home Roster has
 * always resolved it, and this said "iron-mongrel" where that said "Iron
 * Mongrel".
 */
function chassisOf(chassisRef: string): { name: string; techLevel?: number } {
  // `resolveChassisRef` throws when the Chassis model is not preloaded (test
  // and snapshot contexts), so this falls back rather than taking the screen
  // down with it — the same guard the Roster's `mechChassisMeta` uses.
  try {
    const chassis = resolveChassisRef(chassisRef) as { name: string; techLevel?: number } | null
    return chassis ?? { name: chassisRef }
  } catch {
    return { name: chassisRef }
  }
}

/**
 * The ownership seal: one stamp in the row's top-right corner saying who holds
 * this character — `UNCLAIMED`, `YOU`, or a crewmate's name.
 *
 * ## One mark, three states
 *
 * Ownership is one fact, so it gets one mark. The surface previously said it
 * two ways at once: an owner chip in the caption for held characters, and a
 * separate UNCLAIMED stamp among the buttons for free ones — two vocabularies
 * for a single field, in two different places, so scanning a column meant
 * checking both. A seal that is always present and always in the same corner
 * can be read down a list without reading anything else.
 *
 * Stamped rather than chipped for the reason documents are stamped: it is a
 * mark applied ON the record about its status, not a property of the character
 * itself.
 *
 * ## Why UNCLAIMED is the pressable one
 *
 * An unclaimed pre-gen is an *offer*, so the thing that announces it is also
 * the thing you press. The other two states are statements of fact with nothing
 * to do — pressing "MARA" should not do anything, and it does not.
 *
 * It opens a confirm rather than claiming outright: taking a character is a
 * commitment at the table, and the modal is where the surface says what happens
 * next (it becomes yours, and it lands in this browser).
 */
function OwnerSeal({
  owner,
  claimable,
  disabled,
  onClaim,
}: {
  owner: OwnerChip
  claimable: boolean
  disabled: boolean
  onClaim: () => void
}) {
  // The default stamp plate: ink ground, paper text, at the smallest rung —
  // a plate riveted across the row's top border, subordinate to the name it
  // sits beside. It was `inverse` (paper ground, ink text) at `compact`, which
  // read as another chip floating near the corner rather than as a mark
  // stamped ON the record.
  const stamp = (
    <Badge shape="stamp" size="mini" className="tracking-caps-wide">
      {owner.label}
    </Badge>
  )

  if (!claimable) {
    // Inert: a fact about the row, not a control.
    return stamp
  }

  return (
    <button
      type="button"
      onClick={onClaim}
      disabled={disabled}
      aria-label={`${owner.label} — pick this up`}
      className={cn(
        'cursor-pointer border-0 bg-transparent p-0',
        'transition-transform duration-200 hover:-translate-y-px disabled:cursor-default disabled:opacity-50'
      )}
    >
      {stamp}
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
          {/* An h2, so the columns' h3s sit under something. The page reads
              h1 (Game) → h2 (the crew, the panels) → h3 (Pilots / Mechs /
              Crawlers); as a div it skipped a level and left the columns
              parented by nothing. */}
          <Text as="h2" className={SECTION}>
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
                          linkAs={AppLink}
                          /* Every row is a door now. View goes to the frozen
                             crew sheet (`GameEntitySheet`) for EVERY row,
                             including your own: it is a plain anchor to a
                             read-only surface, so it needs no adoption round
                             trip and behaves like the Roster's View. Editing
                             is the separate, owner-only verb beside it. */
                          sheetHref={`/games/${gameId}/view/${row.kind}/${row.serverId}`}
                          seal={
                            row.owner === null ? undefined : (
                              <OwnerSeal
                                owner={row.owner}
                                claimable={row.can.claim}
                                disabled={busy !== null}
                                onClaim={() => setClaimTarget(row)}
                              />
                            )
                          }
                          actions={
                            <>
                              {row.can.openSheet && (
                                <Button
                                  variant="default"
                                  size="mini"
                                  disabled={busy !== null}
                                  onClick={() =>
                                    void run(`open-${row.serverId}`, () => openSheet(row))
                                  }
                                >
                                  Edit
                                </Button>
                              )}
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
                                  size="mini"
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
