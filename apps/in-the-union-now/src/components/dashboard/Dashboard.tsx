/**
 * Dashboard — "ITUN · Saved Builds" (design-spec §3.1, §3.7).
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

import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Btn, btnVariants, Empty } from 'suref-react'

import type { SoftLink } from '../../lib/schemas/softLink'
import { resolveClassName } from '../../lib/classRef'
import { cn } from '../../lib/utils'
import type { EntityType } from '../../stores/entityStore'
import { useEntityStore } from '../../stores/entityStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { ExportAllButton } from '../export/ExportAllButton'
import { ImportButton } from '../export/ImportButton'
import { AppLink } from '../shared/AppLink'
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher'
import { DashboardSkeleton } from './DashboardSkeleton'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { EntityListItem } from './EntityListItem'

// ---------------------------------------------------------------------------
// Row-meta helpers
// ---------------------------------------------------------------------------

/** Dashboard row meta segment for a mech: "Chassis · TL n". */
function mechChassisMeta(chassisRef: string): string | undefined {
  try {
    const all = SalvageUnionReference.Chassis.all() as ReadonlyArray<{
      name: string
      techLevel?: number
    }>
    const c = all.find((x) => x.name === chassisRef)
    if (!c) return chassisRef || undefined
    return c.techLevel != null ? `${c.name} · TL ${c.techLevel}` : c.name
  } catch {
    return chassisRef || undefined
  }
}

/** Dashboard row meta segment for a crawler: "TL n · m bays". */
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

export function Dashboard() {
  const store = useEntityStore()
  const workspaceStore = useWorkspaceStore()
  const [hydratedAll, setHydratedAll] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  /** null = "All Builds" (show all), string = filter by workspace id */
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  /** Mobile-endpoint segmented switch (design §3.7) — which column shows ≤ md */
  const [activeSegment, setActiveSegment] = useState<SegmentKind>('pilot')

  // Hydrate all three entity types + softLinks + workspaces on mount.
  useEffect(() => {
    const run = async () => {
      await Promise.all([
        store.hydrate('pilot'),
        store.hydrate('mech'),
        store.hydrate('crawler'),
        store.hydrate('softLink'),
        workspaceStore.hydrate(),
      ])
      setHydratedAll(true)
    }
    void run()
    // Only run once on mount; stores are stable (Zustand singletons).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allPilots = store.list('pilot')
  const allMechs = store.list('mech')
  const allCrawlers = store.list('crawler')
  const softLinks: SoftLink[] = store.list('softLink')

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

  // Filter by active workspace. "All Builds" (null) shows all entities.
  const pilots =
    activeWorkspaceId === null
      ? allPilots
      : allPilots.filter((p) => p.workspaceId === activeWorkspaceId)
  const mechs =
    activeWorkspaceId === null
      ? allMechs
      : allMechs.filter((m) => m.workspaceId === activeWorkspaceId)
  const crawlers =
    activeWorkspaceId === null
      ? allCrawlers
      : allCrawlers.filter((c) => c.workspaceId === activeWorkspaceId)

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
          </div>
          <WorkspaceSwitcher
            activeWorkspaceId={activeWorkspaceId}
            onSelect={setActiveWorkspaceId}
          />
        </div>
      </div>

      {/* Reserve a stable footprint so the grid replacing "Loading…" doesn't
          shift the rest of the page on hydration. */}
      <div className="min-h-[60vh]">
        {!hydratedAll ? (
          <DashboardSkeleton />
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
              <DashboardColumn
                title="Pilots"
                headingId="pilots-heading"
                active={activeSegment === 'pilot'}
                createHref="/pilots/new"
                createLabel="Create Pilot"
                emptyLabel="No pilots yet."
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
                      href={`/pilots/${p.id}`}
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
              </DashboardColumn>

              <DashboardColumn
                title="Mechs"
                headingId="mechs-heading"
                active={activeSegment === 'mech'}
                createHref="/mechs/new"
                createLabel="Create Mech"
                emptyLabel="No mechs yet."
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
                      href={`/mechs/${m.id}`}
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
              </DashboardColumn>

              <DashboardColumn
                title="Crawlers"
                headingId="crawlers-heading"
                active={activeSegment === 'crawler'}
                createHref="/crawlers/new"
                createLabel="Create Crawler"
                emptyLabel="No crawlers yet."
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
                      href={`/crawlers/${c.id}`}
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
              </DashboardColumn>
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
// Sub-component
// ---------------------------------------------------------------------------

type DashboardColumnProps = {
  title: string
  headingId: string
  /** Whether this column is the active mobile segment (always shown ≥ md). */
  active: boolean
  createHref: string
  createLabel: string
  emptyLabel: string
  /** Extra head action (e.g. the Mechs column's 'Patterns' link). */
  headExtra?: ReactNode
  /** SavedRow <EntityListItem> children; empty → dashed create empty. */
  children: ReactNode[]
}

function DashboardColumn({
  title,
  headingId,
  active,
  createHref,
  createLabel,
  emptyLabel,
  headExtra,
  children,
}: DashboardColumnProps) {
  return (
    <section aria-labelledby={headingId} className={cn(!active && 'hidden md:block')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          id={headingId}
          className="font-cond text-base font-bold uppercase tracking-[.1em] text-rust"
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
        <Empty message={emptyLabel}>
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
