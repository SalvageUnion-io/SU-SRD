/**
 * Roster — "ITUN · Saved Builds" (design-spec §3.1, §3.7).
 *
 * On mount: calls entityStore.hydrate() for all three entity types +
 * softLinks + workspaceStore.hydrate().
 * After hydration: renders the header (h1 + Download all/Import row + the
 * workspace faux-select) over a 3-col Pilots/Mechs/Crawlers grid of SavedRows.
 * Row meta encodes cross-links via '↳ Name' sheet links (mech-to-pilot,
 * pilot-to-crawler softLinks). At the mobile endpoint (≤ md) the columns
 * collapse to a single column behind a segmented Pilot/Mech/Crawler switch
 * (active = rust fill).
 *
 * Delete flow:
 *   1. User clicks "Delete" on an EntityListItem.
 *   2. DeleteConfirmDialog opens.
 *   3. User confirms → entityStore.delete() is called, entity removed from
 *      listing immediately (Zustand in-memory update is synchronous).
 */

import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import { Bot, UserRound, Warehouse } from 'lucide-react'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'
import { Btn, btnVariants, Empty } from 'suref-react'

import {
  setActiveWorkspaceId,
  useActiveWorkspaceId,
  useCrawlers,
  useHydrateEntities,
  useMechs,
  usePilots,
  useSoftLinkList,
} from '../../hooks/queries'
import type { SoftLink } from '../../lib/schemas/softLink'
import { resolveClassName } from '../../lib/classRef'
import { cn } from '../../lib/utils'
import type { EntityType } from '../../stores/entityStore'
import { DEFAULT_WORKSPACE_ID } from '../../lib/defaultWorkspace'
import { ensureStarterSetSeeded } from '../../lib/starterSet/seedStarterSet'
import { STARTER_WORKSPACE_ID } from '../../lib/starterSet/starterSet'
import { ensureEldridgeCoastSeeded } from '../../lib/eldridgeCoast/seedEldridgeCoast'
import { ELDRIDGE_WORKSPACE_ID } from '../../lib/eldridgeCoast/eldridgeCoast'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import { ExportAllButton } from '../export/ExportAllButton'
import { ImportButton } from '../export/ImportButton'
import { DashboardChooser } from '../dashboard/DashboardChooser'
import { AppLink } from '../shared/AppLink'
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher'
import { RosterSkeleton } from './RosterSkeleton'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { EntityListItem } from './EntityListItem'

// ---------------------------------------------------------------------------
// Row-meta helpers
// ---------------------------------------------------------------------------

/** Roster row meta segment for a mech: "Chassis · TL n". */
function mechChassisMeta(chassisRef: string): string | undefined {
  // resolveChassisRef is slug/name/id tolerant; stored refs are slugs, so a
  // name-only match here would fall through to the raw slug for every mech. Wrap
  // in try/catch: resolveChassisRef throws when the Chassis model isn't preloaded
  // (some test/snapshot contexts) — fall back to the raw ref rather than crash.
  try {
    const c = resolveChassisRef(chassisRef) as { name: string; techLevel?: number } | null
    if (!c) return chassisRef || undefined
    return c.techLevel != null ? `${c.name} · TL ${c.techLevel}` : c.name
  } catch {
    return chassisRef || undefined
  }
}

/** Roster row meta segment for a crawler: "TL n · m bays". */
function crawlerTypeMeta(techLevel: string, bayCount: number): string {
  const tl = techLevel.replace(/[^0-9]/g, '')
  const parts: string[] = []
  if (tl) parts.push(`TL ${tl}`)
  parts.push(`${bayCount} ${bayCount === 1 ? 'bay' : 'bays'}`)
  return parts.join(' · ')
}

/** Join meta segments with the design's ' · ' separator, dropping blanks. */
function joinMeta(parts: Array<ReactNode | null | undefined>): ReactNode | undefined {
  const kept = parts.filter((part) => part != null && part !== '')
  if (kept.length === 0) return undefined
  return kept.map((part, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: meta parts are positional ReactNodes with no stable identity; the joined caption never reorders
    <Fragment key={i}>
      {i > 0 && ' · '}
      {part}
    </Fragment>
  ))
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
  /** The current workspace (global, persisted) — always a concrete id. */
  const activeWorkspaceId = useActiveWorkspaceId()
  /** Mobile-endpoint segmented switch (design §3.7) — which column shows ≤ md */
  const [activeSegment, setActiveSegment] = useState<SegmentKind>('pilot')

  // Hydrate all three entity types + softLinks + workspaces on mount.
  const hydratedAll = useHydrateEntities(['pilot', 'mech', 'crawler', 'softLink'], {
    workspaces: true,
  })

  const allPilots = usePilots()
  const allMechs = useMechs()
  const allCrawlers = useCrawlers()
  const softLinks: SoftLink[] = useSoftLinkList()
  // Saved patterns are global (not workspace-scoped) — the Dashboard chooser
  // offers them as stand-in mechs, so their presence also enables a launch.
  const patterns = usePatternStore((s) => s.mechPatterns)
  usePatternStore.getState().list()

  // Name lookups for '↳ Name' cross-links — built from the UNFILTERED lists so
  // links resolve across workspace boundaries.
  const pilotNameById = new Map(allPilots.map((p) => [p.id, p.name]))
  const mechNameById = new Map(allMechs.map((m) => [m.id, m.name]))
  const crawlerNameById = new Map(allCrawlers.map((c) => [c.id, c.name]))

  /**
   * '↳ Name' segment as a link to the target entity's live sheet (design
   * review U-4), or undefined when the target id/name can't be resolved.
   */
  function linkSegment(
    kind: SegmentKind,
    id: string | undefined,
    name: string | undefined
  ): ReactNode | undefined {
    if (!id || !name) return undefined
    return (
      <AppLink
        href={`/sheet/${kind}/${id}`}
        className="text-wk-muted underline decoration-wk-muted/50 underline-offset-2 hover:text-rust"
      >
        ↳ {name}
      </AppLink>
    )
  }

  // Filter to the current workspace — the only view now (no cross-workspace
  // "All Builds"). Everything created here is stamped with this workspace.
  const pilots = allPilots.filter((p) => p.workspaceId === activeWorkspaceId)
  const mechs = allMechs.filter((m) => m.workspaceId === activeWorkspaceId)
  const crawlers = allCrawlers.filter((c) => c.workspaceId === activeWorkspaceId)

  /**
   * First-run welcome: only for a brand-new user sitting in an empty DEFAULT
   * workspace. Any other empty workspace (a fresh campaign the user made, or the
   * un-summoned Starter Set) falls through to the normal grid with its per-column
   * "create" empty states — the big welcome would misfire there.
   */
  const isFirstRun =
    activeWorkspaceId === DEFAULT_WORKSPACE_ID &&
    pilots.length === 0 &&
    mechs.length === 0 &&
    crawlers.length === 0

  /**
   * Workspace select. Opening a built-in workspace (Starter Set, The Eldridge
   * Coast) spawns it into this browser on first visit (idempotent), then
   * switches to it — the roster is never seeded until the user asks for it here.
   */
  async function handleSelectWorkspace(id: string) {
    if (id === STARTER_WORKSPACE_ID) await ensureStarterSetSeeded()
    if (id === ELDRIDGE_WORKSPACE_ID) await ensureEldridgeCoastSeeded()
    setActiveWorkspaceId(id)
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
    <main className="min-h-screen bg-wk-bg px-4 py-5 sm:px-8 sm:py-10 lg:px-12">
      {/* Brand identity lives in the global AppHeader (routes/__root.tsx);
          the page keeps an accessible title only. Visible header row:
          Download all/Import · workspace faux-select. */}
      <h1 className="sr-only">Saved Builds</h1>
      <div className="border-b-2 border-ink pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-start gap-2.5">
            <ExportAllButton />
            <ImportButton />
            {/* Launch the Dashboard for a chosen pilot/mech/crawler crew
                (design-spec §8). Shown once the CURRENT workspace has a mech to
                run, or any saved pattern exists to launch as a stand-in — the
                chooser scopes saved mechs to this workspace. */}
            {(mechs.length > 0 || patterns.length > 0) && (
              <DashboardChooser activeWorkspaceId={activeWorkspaceId} />
            )}
          </div>
          <WorkspaceSwitcher
            activeWorkspaceId={activeWorkspaceId}
            onSelect={(id) => void handleSelectWorkspace(id)}
          />
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
                <Btn
                  key={seg.kind}
                  size="sm"
                  variant={activeSegment === seg.kind ? 'primary' : 'default'}
                  aria-pressed={activeSegment === seg.kind}
                  onClick={() => setActiveSegment(seg.kind)}
                  className="min-h-11 flex-1"
                >
                  {seg.label}
                </Btn>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-8 md:mt-6 md:grid-cols-3">
              <RosterColumn
                title="Pilots"
                headingId="pilots-heading"
                active={activeSegment === 'pilot'}
                createHref="/pilots/new"
                createLabel="Create Pilot"
                emptyLabel="No pilots yet."
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
                    <EntityListItem
                      key={p.id}
                      id={p.id}
                      name={p.name}
                      entityType="pilot"
                      sheetHref={`/sheet/pilot/${p.id}`}
                      onDeleteClick={(id, name) => openDeleteDialog('pilot', id, name)}
                      meta={joinMeta([
                        p.callsign ? `"${p.callsign}"` : null,
                        resolveClassName(p.classRef),
                        linkSegment(
                          'mech',
                          mechLink?.from.id,
                          mechLink && mechNameById.get(mechLink.from.id)
                        ),
                        linkSegment(
                          'crawler',
                          crawlerLink?.to.id,
                          crawlerLink && crawlerNameById.get(crawlerLink.to.id)
                        ),
                      ])}
                    />
                  )
                })}
              </RosterColumn>

              <RosterColumn
                title="Mechs"
                headingId="mechs-heading"
                active={activeSegment === 'mech'}
                createHref="/mechs/new"
                createLabel="Create Mech"
                emptyLabel="No mechs yet."
                emptyIcon={<Bot className="size-7 text-sheet-mech-deep" />}
                headExtra={
                  <AppLink
                    href="/mechs/patterns"
                    className={cn(btnVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
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
                    <EntityListItem
                      key={m.id}
                      id={m.id}
                      name={m.name}
                      entityType="mech"
                      sheetHref={`/sheet/mech/${m.id}`}
                      onDeleteClick={(id, name) => openDeleteDialog('mech', id, name)}
                      meta={joinMeta([
                        mechChassisMeta(m.chassisRef),
                        linkSegment(
                          'pilot',
                          pilotLink?.to.id,
                          pilotLink && pilotNameById.get(pilotLink.to.id)
                        ),
                      ])}
                    />
                  )
                })}
              </RosterColumn>

              <RosterColumn
                title="Crawlers"
                headingId="crawlers-heading"
                active={activeSegment === 'crawler'}
                createHref="/crawlers/new"
                createLabel="Create Crawler"
                emptyLabel="No crawlers yet."
                emptyIcon={<Warehouse className="size-7 text-sheet-crawler-deep" />}
              >
                {crawlers.map((c) => {
                  const crewLinks = softLinks.filter(
                    (l) => l.type === 'pilot-to-crawler' && l.to.id === c.id
                  )
                  return (
                    <EntityListItem
                      key={c.id}
                      id={c.id}
                      name={c.name}
                      entityType="crawler"
                      sheetHref={`/sheet/crawler/${c.id}`}
                      onDeleteClick={(id, name) => openDeleteDialog('crawler', id, name)}
                      meta={joinMeta([
                        crawlerTypeMeta(c.techLevel, c.crawlerBays?.length ?? 0),
                        ...crewLinks.map((l) =>
                          linkSegment('pilot', l.from.id, pilotNameById.get(l.from.id))
                        ),
                      ])}
                    />
                  )
                })}
              </RosterColumn>
            </div>
          </>
        )}
      </div>

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        entityName={deleteTarget?.name ?? ''}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={handleCancelDelete}
      />
    </main>
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
    <div className="mt-6 flex flex-col items-center gap-4 rounded-[3px] border-[1.5px] border-dashed border-wk-faint p-8 text-center sm:p-12">
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
        className={cn(btnVariants({ variant: 'primary', size: 'md' }), 'no-underline')}
      >
        Build your first pilot
      </AppLink>
      <p className="max-w-prose font-body text-xs text-wk-muted">
        Workspaces let you group builds by campaign — everything you make lives only in this
        browser.
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
  emptyLabel: string
  /** Entity-tone glyph shown above the empty-state message (design review U-6). */
  emptyIcon?: ReactNode
  /** Extra head action (e.g. the Mechs column's 'Patterns' link). */
  headExtra?: ReactNode
  /** SavedRow <EntityListItem> children; empty → dashed create empty. */
  children: ReactNode[]
}

function RosterColumn({
  title,
  headingId,
  active,
  createHref,
  createLabel,
  emptyLabel,
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
              className={cn(btnVariants({ variant: 'default', size: 'sm' }), 'no-underline')}
            >
              + {createLabel}
            </AppLink>
          )}
        </div>
      </div>
      {children.length === 0 ? (
        <Empty message={emptyLabel} icon={emptyIcon}>
          <AppLink
            href={createHref}
            className={cn(btnVariants({ variant: 'primary', size: 'sm' }), 'no-underline')}
          >
            {createLabel}
          </AppLink>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2.5">{children}</ul>
      )}
    </section>
  )
}
