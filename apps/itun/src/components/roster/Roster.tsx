/**
 * Roster — "ITUN · Saved Builds" (design-spec §3.1, §3.7).
 *
 * On mount: calls entityStore.hydrate() for all three entity types + softLinks.
 * After hydration: renders the header (h1 + Download all/Import row + the
 * container faux-select) over a 3-col Pilots/Mechs/Crawlers grid of SavedRows.
 * Row meta encodes cross-links via '↳ Name' sheet links (mech-to-pilot,
 * pilot-to-crawler softLinks). At the mobile endpoint (≤ md) the columns
 * collapse to a single column behind a segmented Pilot/Mech/Crawler switch
 * (active = rust fill).
 *
 * Delete flow:
 *   1. User clicks "Delete" on an EntityRow.
 *   2. An inline danger-tone ModalShell confirm opens.
 *   3. User confirms → entityStore.delete() is called, entity removed from
 *      listing immediately (Zustand in-memory update is synchronous).
 */

import type { EntityRowStat } from 'component-lib'
import {
  Button,
  buttonVariants,
  EmptyState,
  EntityRow,
  ModalShell,
  PageShell,
  RosterSkeleton,
  Stat,
} from 'component-lib'
import { Bot, UserRound, Warehouse } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import {
  useCrawlers,
  useHydrateEntities,
  useMechs,
  usePilots,
  useSoftLinkList,
} from '../../hooks/queries'
import { resolveClassName } from '../../lib/classRef'
import { useConnection } from '../../lib/connection/connectionContext'
import type { ContainerFields } from '../../lib/container'
import { containerOf, sameContainer } from '../../lib/container'
import type { SoftLink } from '../../lib/schemas/softLink'
import { ensureStarterSetSeeded, isStarterSetSeeded } from '../../lib/starterSet/seedStarterSet'
import { cn } from '../../lib/utils'
import { setActiveContainer, useActiveContainer } from '../../stores/activeContainerStore'
import type { EntityType } from '../../stores/entityStore'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import { ContainerSwitcher } from '../container/ContainerSwitcher'
import { DashboardChooser } from '../dashboard/DashboardChooser'
import { ExportAllButton } from '../export/ExportAllButton'
import { ImportButton } from '../export/ImportButton'
import { AppLink } from '../shared/AppLink'

// ---------------------------------------------------------------------------
// Row-meta helpers
// ---------------------------------------------------------------------------

/**
 * A mech row's stats: `CHASSIS | Iron Mongrel`, and `TL | 1` beside it.
 *
 * These used to be one caption string, "Iron Mongrel · TL 1" — two facts joined
 * by a separator, which is the shape `Stat` exists to replace. TL is its own
 * stat rather than a suffix for the same reason.
 *
 * resolveChassisRef is slug/name/id tolerant; stored refs are slugs, so a
 * name-only match here would fall through to the raw slug for every mech. Wrap
 * in try/catch: resolveChassisRef throws when the Chassis model isn't preloaded
 * (some test/snapshot contexts) — fall back to the raw ref rather than crash.
 */
function mechChassisStats(chassisRef: string): EntityRowStat[] | undefined {
  if (!chassisRef) return undefined
  let resolved: { name: string; techLevel?: number } | null = null
  try {
    resolved = resolveChassisRef(chassisRef) as { name: string; techLevel?: number } | null
  } catch {
    resolved = null
  }

  const stats: EntityRowStat[] = [{ label: 'Chassis', value: resolved?.name ?? chassisRef }]
  if (resolved?.techLevel != null) stats.push({ label: 'TL', value: resolved.techLevel })
  return stats
}

/**
 * A crawler row's stats: `TL | 2`, `BAYS | 3`.
 *
 * Was the caption string "TL 2 · 3 bays" — the same two-facts-one-separator
 * shape the chassis had, and the same fix. These are the labels the crew roster
 * already used, so the two surfaces now read identically.
 */
function crawlerStats(techLevel: string, bayCount: number): EntityRowStat[] {
  const tl = techLevel.replace(/[^0-9]/g, '')
  const stats: EntityRowStat[] = []
  if (tl) stats.push({ label: 'TL', value: tl })
  stats.push({ label: 'Bays', value: bayCount })
  return stats
}

/**
 * A pilot row's header stats: `CLASS | Scavenger`, `CALLSIGN | Ghost`.
 *
 * These lived in the body as tone-tinted chips. They are `label | value` facts
 * like any other, so they belong in the band with the rest, on the plain ink
 * label plate every other stat uses — the tint was a second way of saying what
 * the band already says.
 *
 * No HP/AP here: a roster answers "what have I got", not "how hurt is it".
 */
function pilotStats(classRef: string, callsign?: string): EntityRowStat[] | undefined {
  const stats: EntityRowStat[] = []
  const className = resolveClassName(classRef)
  if (className) stats.push({ label: 'Class', value: className })
  if (callsign) stats.push({ label: 'Callsign', value: callsign })
  return stats.length > 0 ? stats : undefined
}

/**
 * The row's body details, blanks dropped.
 *
 * These used to be joined into one muted line with ' · ' separators, then became
 * chips, and are now `label | value` stats — each step removing an inference the
 * reader was making on the row's behalf.
 */
function metaParts(parts: Array<ReactNode | null | undefined>): ReactNode[] | undefined {
  const kept = parts.filter((part) => part != null && part !== '')
  return kept.length === 0 ? undefined : kept
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeleteTarget = {
  type: EntityType
  id: string
  name: string
}

type SegmentKind = 'pilot' | 'mech' | 'crawler'

/**
 * Label-plate tints for a cross-link, keyed to the TARGET's ontology — the same
 * `--color-sheet-*` tokens `EntityRow` bands itself with, so a link to a mech
 * is the green a mech row wears. Crawler takes paper text; it is the one dark
 * fill in the ramp.
 */
const TONE_BG: Record<SegmentKind, string> = {
  pilot: 'var(--color-sheet-pilot)',
  mech: 'var(--color-sheet-mech)',
  crawler: 'var(--color-sheet-crawler)',
}
const TONE_INK: Record<SegmentKind, string> = {
  pilot: 'var(--color-ink)',
  mech: 'var(--color-ink)',
  crawler: 'var(--color-paper)',
}

const SEGMENTS: ReadonlyArray<{ kind: SegmentKind; label: string }> = [
  { kind: 'pilot', label: 'Pilots' },
  { kind: 'mech', label: 'Mechs' },
  { kind: 'crawler', label: 'Crawlers' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Roster() {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  /** The current container (global, persisted). Only consulted when Connected. */
  const activeContainer = useActiveContainer()
  const { mode } = useConnection()
  /** Mobile-endpoint segmented switch (design §3.7) — which column shows ≤ md */
  const [activeSegment, setActiveSegment] = useState<SegmentKind>('pilot')

  // Hydrate all three entity types + softLinks on mount.
  const hydratedAll = useHydrateEntities(['pilot', 'mech', 'crawler', 'softLink'])

  const allPilots = usePilots()
  const allMechs = useMechs()
  const allCrawlers = useCrawlers()
  const softLinks: SoftLink[] = useSoftLinkList()
  // Saved patterns are global (not container-scoped) — the Dashboard chooser
  // offers them as stand-in mechs, so their presence also enables a launch.
  const patterns = usePatternStore((s) => s.mechPatterns)
  usePatternStore.getState().list()

  // Name lookups for '↳ Name' cross-links — built from the UNFILTERED lists so
  // links resolve across container boundaries.
  const pilotNameById = new Map(allPilots.map((p) => [p.id, p.name]))
  const mechNameById = new Map(allMechs.map((m) => [m.id, m.name]))
  const crawlerNameById = new Map(allCrawlers.map((c) => [c.id, c.name]))
  // …and the one fact each cross-link states about its target, so a link reads
  // `IRON JAW | Titan` rather than naming a thing and saying nothing about it.
  const pilotClassById = new Map(allPilots.map((p) => [p.id, resolveClassName(p.classRef)]))
  const mechChassisNameById = new Map(
    allMechs.map((m) => [m.id, mechChassisStats(m.chassisRef)?.[0]?.value as string | undefined])
  )
  const crawlerTlById = new Map(
    allCrawlers.map((c) => {
      const tl = c.techLevel.replace(/[^0-9]/g, '')
      return [c.id, tl ? `TL ${tl}` : undefined]
    })
  )

  /**
   * A cross-link to another entity's live sheet, as a Badge tinted with THAT
   * entity's ontology tone (design review U-4).
   *
   * These used to be muted '↳ Name' underlined text. The row already tones its
   * own rail by ontology, so a monochrome cross-link was the one place on the
   * row where "which kind of thing is this?" had to be read rather than seen —
   * and a pilot linking to both a mech and a crawler rendered two visually
   * identical segments. The tone comes from the TARGET's kind, never the row's.
   *
   * Badge wrapped in the link rather than rendered `as={AppLink}`: its chip
   * props are typed for a span and carry no `href`. This is the same shape the
   * live-sheet header already uses for its linked-unit badges, so the two read
   * identically — one anchor, one focus stop.
   */
  function linkSegment(
    kind: SegmentKind,
    id: string | undefined,
    name: string | undefined,
    detail: string | undefined
  ): ReactNode | undefined {
    if (!id || !name) return undefined
    return (
      <AppLink
        href={`/sheet/${kind}/${id}`}
        className="inline-flex max-w-full align-middle no-underline"
        aria-label={`Open ${name}'s ${kind} sheet`}
      >
        {/* `NAME | detail` — the linked entity names ITSELF on the label plate
            (a mech's name IS its pattern, SU rules), with its defining fact as
            the value: a mech's chassis, a pilot's class, a crawler's TL. The
            plate is tinted with the TARGET's ontology, never the row's, so the
            kind of thing you are about to open is seen rather than read. */}
        <Stat
          label={name}
          value={detail ?? '—'}
          orientation="horizontal"
          size="mini"
          bgColor={TONE_BG[kind]}
          textColor={TONE_INK[kind]}
        />
      </AppLink>
    )
  }

  /**
   * Scope the roster to the current container — but ONLY when signed in.
   *
   * A Solo user has no Games (there is no account, so nothing to share with),
   * which makes their builds one pile and any filter of it a filter on a
   * distinction that does not exist for them. Worse, it would hide things:
   * migration v13 mapped every non-Default workspace onto `gameId: <that
   * workspace id>`, so a Solo user who once used Workspaces has entities
   * addressed by ids matching no real Game. Showing the pile whole is both
   * simpler and the only rendering that cannot lose a build.
   */
  const inContainer = <T extends ContainerFields>(list: T[]): T[] => {
    if (mode !== 'connected') return list
    return list.filter((e) => sameContainer(containerOf(e), activeContainer))
  }

  const pilots = inContainer(allPilots)
  const mechs = inContainer(allMechs)
  const crawlers = inContainer(allCrawlers)

  /**
   * Raising a crawler INSIDE a Game is the table runner's act (ADR-030 §5a), so
   * while a Game is the current container this CTA hands off to that Game's
   * crew surface, which knows who the viewer is and either offers the control
   * or explains why it cannot.
   *
   * The alternative — keeping the wizard link and letting the write fail — is
   * the worst of both: `entityStore.create` stamps the current container, the
   * crawler is built locally, the mirror is refused, and the roster shows a
   * crawler that the Game does not have. Deciding it here needs no permission
   * lookup, because the container alone is enough to know this is the wrong
   * door.
   */
  const inGame = mode === 'connected' && activeContainer.kind === 'game'
  const crawlerCreateHref = inGame
    ? `/games/${activeContainer.kind === 'game' ? activeContainer.gameId : ''}`
    : '/crawlers/new'
  const crawlerCreateLabel = inGame ? 'Raise one in this game' : 'Create Crawler'

  /**
   * First-run welcome: a brand-new user with nothing at all. Deliberately keyed
   * to the UNFILTERED lists — an empty *container* belonging to someone who
   * already has builds elsewhere is not a first run, and the big welcome would
   * misfire there. Those fall through to the normal grid and its per-column
   * "create" empty states.
   */
  const isFirstRun = allPilots.length === 0 && allMechs.length === 0 && allCrawlers.length === 0

  /**
   * Spawn the built-in Starter Set onto the Shelf (idempotent, opt-in).
   *
   * `isStarterSetSeeded` reads the entity store, so it re-evaluates on the
   * rehydrate the seed performs — the button disappears on its own once the
   * rows land, with no extra state to keep in sync.
   */
  const starterSeeded = allPilots.length > 0 && isStarterSetSeeded()
  const [seedingStarter, setSeedingStarter] = useState(false)
  async function handleLoadStarterSet() {
    setSeedingStarter(true)
    try {
      await ensureStarterSetSeeded()
    } finally {
      setSeedingStarter(false)
    }
  }

  function openDeleteDialog(type: EntityType, id: string, name: string) {
    setDeleteTarget({ type, id, name })
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    await useEntityStore.getState().delete(deleteTarget.type, deleteTarget.id)
    setDeleteTarget(null)
  }

  function handleCancelDelete() {
    setDeleteTarget(null)
  }

  return (
    <PageShell stack={false}>
      {/* Brand identity lives in the global AppHeader (routes/__root.tsx);
          the page keeps an accessible title only. Visible header row:
          Download all/Import · container faux-select. */}
      <h1 className="sr-only">Saved Builds</h1>
      <div className="border-b-2 border-ink pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-start gap-2.5">
            <ExportAllButton />
            <ImportButton />
            {/* The built-in Starter Set, opt-in. It used to be an entry in the
                Workspace switcher; with no Workspaces to switch between it
                needs its own affordance, and it disappears once loaded so it
                never becomes permanent chrome. */}
            {!starterSeeded && (
              <Button
                variant="ghost"
                size="compact"
                disabled={seedingStarter}
                onClick={() => void handleLoadStarterSet()}
              >
                {seedingStarter ? 'Loading…' : 'Load Starter Set'}
              </Button>
            )}
            {/* Launch the Dashboard for a chosen pilot/mech/crawler crew
                (design-spec §8). Shown once the current view has a mech to run,
                or any saved pattern exists to launch as a stand-in — the
                chooser scopes saved mechs to the same container. */}
            {(mechs.length > 0 || patterns.length > 0) && (
              <DashboardChooser
                activeContainer={mode === 'connected' ? activeContainer : undefined}
              />
            )}
          </div>
          <ContainerSwitcher activeContainer={activeContainer} onSelect={setActiveContainer} />
        </div>
        {/* Standing durability notice (not the recurring backup-nudge toast):
            ITUN is local-first with no backend, so this line is always visible
            next to the export controls to keep the "browser-only" fact honest. */}
        <p className="mt-2.5 font-body text-xs text-wk-muted">
          Your data lives only in this browser — export a backup regularly.
        </p>
      </div>

      {/* Reserve a stable footprint so the grid replacing "Loading…" doesn't
          shift the rest of the page on hydration. */}
      <div className="min-h-[60vh]">
        {!hydratedAll ? (
          <RosterSkeleton />
        ) : isFirstRun ? (
          <FirstRunWelcome />
        ) : (
          <>
            {/* Mobile-endpoint segmented Pilot/Mech/Crawler switch (design §3.7) */}
            <div className="mt-5 flex gap-2 md:hidden">
              {SEGMENTS.map((seg) => (
                <Button
                  key={seg.kind}
                  size="compact"
                  variant={activeSegment === seg.kind ? 'primary' : 'default'}
                  aria-pressed={activeSegment === seg.kind}
                  onClick={() => setActiveSegment(seg.kind)}
                  className="min-h-11 flex-1"
                >
                  {seg.label}
                </Button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-8 md:mt-6 md:grid-cols-3">
              <RosterColumn
                title="Pilots"
                headingId="pilots-heading"
                active={activeSegment === 'pilot'}
                createHref="/pilots/new"
                createLabel="Create Pilot"
                emptyMessage="No pilots yet."
                emptyIcon={<UserRound className="size-7 text-sheet-pilot-deep" />}
              >
                {pilots.map((p) => {
                  const mechLink = softLinks.find(
                    (l) => l.type === 'mech-to-pilot' && l.to.id === p.id
                  )
                  const crawlerLink = softLinks.find(
                    (l) => l.type === 'pilot-to-crawler' && l.from.id === p.id
                  )
                  return (
                    <li key={p.id} className="list-none">
                      <EntityRow
                        entityType="pilot"
                        name={p.name}
                        sheetHref={`/sheet/pilot/${p.id}`}
                        linkAs={AppLink}
                        onDeleteClick={() => openDeleteDialog('pilot', p.id, p.name)}
                        stats={pilotStats(p.classRef, p.callsign)}
                        metaLine={metaParts([
                          linkSegment(
                            'mech',
                            mechLink?.from.id,
                            mechLink && mechNameById.get(mechLink.from.id),
                            mechLink && mechChassisNameById.get(mechLink.from.id)
                          ),
                          linkSegment(
                            'crawler',
                            crawlerLink?.to.id,
                            crawlerLink && crawlerNameById.get(crawlerLink.to.id),
                            crawlerLink && crawlerTlById.get(crawlerLink.to.id)
                          ),
                        ])}
                      />
                    </li>
                  )
                })}
              </RosterColumn>

              <RosterColumn
                title="Mechs"
                headingId="mechs-heading"
                active={activeSegment === 'mech'}
                createHref="/mechs/new"
                createLabel="Create Mech"
                emptyMessage="No mechs yet."
                emptyIcon={<Bot className="size-7 text-sheet-mech-deep" />}
                headExtra={
                  <AppLink
                    href="/mechs/patterns"
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'compact' }),
                      'no-underline'
                    )}
                  >
                    Patterns
                  </AppLink>
                }
              >
                {mechs.map((m) => {
                  const pilotLink = softLinks.find(
                    (l) => l.type === 'mech-to-pilot' && l.from.id === m.id
                  )
                  return (
                    <li key={m.id} className="list-none">
                      <EntityRow
                        entityType="mech"
                        name={m.name}
                        sheetHref={`/sheet/mech/${m.id}`}
                        linkAs={AppLink}
                        onDeleteClick={() => openDeleteDialog('mech', m.id, m.name)}
                        // The chassis is a STAT (`CHASSIS | Iron Mongrel`), not
                        // a caption chip: it is a named property of the mech,
                        // and a bare chip left the reader to infer what the word
                        // was doing there. Same call the crew roster makes.
                        stats={mechChassisStats(m.chassisRef)}
                        metaLine={metaParts([
                          linkSegment(
                            'pilot',
                            pilotLink?.to.id,
                            pilotLink && pilotNameById.get(pilotLink.to.id),
                            pilotLink && pilotClassById.get(pilotLink.to.id)
                          ),
                        ])}
                      />
                    </li>
                  )
                })}
              </RosterColumn>

              <RosterColumn
                title="Crawlers"
                headingId="crawlers-heading"
                active={activeSegment === 'crawler'}
                createHref={crawlerCreateHref}
                createLabel={crawlerCreateLabel}
                emptyMessage="No crawlers yet."
                emptyIcon={<Warehouse className="size-7 text-sheet-crawler-deep" />}
              >
                {crawlers.map((c) => {
                  const crewLinks = softLinks.filter(
                    (l) => l.type === 'pilot-to-crawler' && l.to.id === c.id
                  )
                  return (
                    <li key={c.id} className="list-none">
                      <EntityRow
                        entityType="crawler"
                        name={c.name}
                        sheetHref={`/sheet/crawler/${c.id}`}
                        linkAs={AppLink}
                        onDeleteClick={() => openDeleteDialog('crawler', c.id, c.name)}
                        stats={crawlerStats(c.techLevel, c.crawlerBays?.length ?? 0)}
                        metaLine={metaParts([
                          ...crewLinks.map((l) =>
                            linkSegment(
                              'pilot',
                              l.from.id,
                              pilotNameById.get(l.from.id),
                              pilotClassById.get(l.from.id)
                            )
                          ),
                        ])}
                      />
                    </li>
                  )
                })}
              </RosterColumn>
            </div>
          </>
        )}
      </div>

      {/* Destructive delete confirm — inline danger-tone ModalShell, like the
          other destructive confirms (WizShell). */}
      <ModalShell
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) handleCancelDelete()
        }}
        title={`Delete ${deleteTarget?.name ?? ''}?`}
        tone="danger"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          <div className="font-body text-sm text-wk-muted">
            This action cannot be undone. {deleteTarget?.name ?? ''} will be permanently removed.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="compact" onClick={handleCancelDelete}>
              Cancel
            </Button>
            <Button variant="danger" size="compact" onClick={() => void handleConfirmDelete()}>
              Delete
            </Button>
          </div>
        </div>
      </ModalShell>
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// First-run welcome
// ---------------------------------------------------------------------------

/**
 * Aggregate empty state shown to a brand-new user (zero pilots + mechs +
 * crawlers). Orients them on what the app is and the pilot → mech → crawler
 * build order, with a single primary CTA (start a pilot). Styled as a sibling
 * of the per-column dashed Empty states (same dashed frame + rust accents),
 * not a bolted-on splash.
 */
function FirstRunWelcome() {
  return (
    <div className="mt-6 flex flex-col items-center gap-4 rounded-card border-chrome border-dashed border-wk-faint p-8 text-center sm:p-12">
      <UserRound aria-hidden="true" className="size-9 text-sheet-pilot-deep" />
      <h2 className="font-cond text-xl font-bold uppercase tracking-widest text-rust">
        Welcome to In the Union Now
      </h2>
      <p className="max-w-prose font-body text-sm text-wk-muted">
        Build and run your Salvage Union crew — start with a pilot, kit them out with a mech, then
        anchor your crew to a Union Crawler.
      </p>
      <AppLink
        href="/pilots/new"
        // Top rung deliberately: this is the Roster's page-level primary CTA. The
        // sm/md merge dropped the default to the app's secondary workhorse size,
        // which reads underweight for a primary page action.
        className={cn(buttonVariants({ variant: 'primary', size: 'full' }), 'no-underline')}
      >
        Build your first pilot
      </AppLink>
      <p className="max-w-prose font-body text-xs text-wk-muted">
        Everything you make lives only in this browser. Sign in to share builds with a Game.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

type RosterColumnProps = {
  title: string
  headingId: string
  /** Whether this column is the active mobile segment (always shown ≥ md). */
  active: boolean
  createHref: string
  createLabel: string
  emptyMessage: string
  /** Entity-tone glyph shown above the empty-state message (design review U-6). */
  emptyIcon?: ReactNode
  /** Extra head action (e.g. the Mechs column's 'Patterns' link). */
  headExtra?: ReactNode
  /** SavedRow <EntityRow> children; empty → dashed create empty. */
  children: ReactNode[]
}

function RosterColumn({
  title,
  headingId,
  active,
  createHref,
  createLabel,
  emptyMessage,
  emptyIcon,
  headExtra,
  children,
}: RosterColumnProps) {
  return (
    <section aria-labelledby={headingId} className={cn(!active && 'hidden md:block')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          id={headingId}
          className="font-cond text-base font-bold uppercase tracking-widest text-rust"
        >
          {title}
        </h2>
        <div className="flex items-center gap-1.5">
          {headExtra}
          {/* One create CTA per column: the header link shows only when the
              column has rows; the empty state renders its own create CTA. */}
          {children.length > 0 && (
            <AppLink
              href={createHref}
              className={cn(
                buttonVariants({ variant: 'default', size: 'compact' }),
                'no-underline'
              )}
            >
              + {createLabel}
            </AppLink>
          )}
        </div>
      </div>
      {children.length === 0 ? (
        <EmptyState
          variant="quiet"
          body={emptyMessage}
          icon={emptyIcon}
          action={
            <AppLink
              href={createHref}
              className={cn(
                buttonVariants({ variant: 'primary', size: 'compact' }),
                'no-underline'
              )}
            >
              {createLabel}
            </AppLink>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">{children}</ul>
      )}
    </section>
  )
}
