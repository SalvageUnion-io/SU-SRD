/**
 * Dashboard — entry-point view for existing pilots, mechs, and crawlers.
 *
 * On mount: calls entityStore.hydrate() for all three entity types + workspaceStore.hydrate().
 * After hydration: renders a WorkspaceSwitcher in the header to filter the lists by workspace.
 *   - "All Builds" (activeWorkspaceId = null) shows ALL entities (unassigned + assigned).
 *   - A specific workspace shows only entities assigned to that workspace.
 * Renders three sections (Pilots, Mechs, Crawlers), each with a compact listing
 * (EntityListItem) and an empty-state CTA.
 *
 * Delete flow:
 *   1. User clicks "Delete" on an EntityListItem.
 *   2. DeleteConfirmDialog opens.
 *   3. User confirms → entityStore.delete() is called, entity removed from
 *      listing immediately (Zustand in-memory update is synchronous).
 */

import { useEffect, useState } from 'react'

import type { EntityType } from '../../stores/entityStore'
import { useEntityStore } from '../../stores/entityStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher'
import { buttonVariants } from '../ui/buttonVariants'
import { cn } from '../../lib/utils'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { EntityListItem } from './EntityListItem'

type DeleteTarget = {
  type: EntityType
  id: string
  name: string
}

export function Dashboard() {
  const store = useEntityStore()
  const workspaceStore = useWorkspaceStore()
  const [hydratedAll, setHydratedAll] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  /** null = "All Builds" (show all), string = filter by workspace id */
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)

  // Hydrate all three entity types + workspaces on mount.
  useEffect(() => {
    const run = async () => {
      await Promise.all([
        store.hydrate('pilot'),
        store.hydrate('mech'),
        store.hydrate('crawler'),
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

  // Filter by active workspace. "All Builds" (null) shows all entities.
  const pilots =
    activeWorkspaceId === null
      ? allPilots
      : allPilots.filter((p) => (p as { workspaceId?: string }).workspaceId === activeWorkspaceId)
  const mechs =
    activeWorkspaceId === null
      ? allMechs
      : allMechs.filter((m) => (m as { workspaceId?: string }).workspaceId === activeWorkspaceId)
  const crawlers =
    activeWorkspaceId === null
      ? allCrawlers
      : allCrawlers.filter((c) => (c as { workspaceId?: string }).workspaceId === activeWorkspaceId)

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
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b-2 border-[var(--color-su-black)] pb-4">
        <h1 className="text-3xl font-bold uppercase tracking-wide">ITUN — Saved Builds</h1>
        <WorkspaceSwitcher activeWorkspaceId={activeWorkspaceId} onSelect={setActiveWorkspaceId} />
      </div>

      {!hydratedAll ? (
        <div aria-label="Loading saved builds" className="py-12 text-center text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Pilots */}
          <section aria-labelledby="pilots-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="pilots-heading"
                className="text-xl font-bold uppercase tracking-wide text-[var(--color-su-orange-dark)]"
              >
                Pilots
              </h2>
              <a
                href="/pilots/new"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'no-underline')}
              >
                + Create Pilot
              </a>
            </div>
            {pilots.length === 0 ? (
              <EmptyState label="No pilots yet." ctaHref="/pilots/new" ctaLabel="Create Pilot" />
            ) : (
              <ul className="flex flex-col gap-2">
                {pilots.map((p) => (
                  <EntityListItem
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    href={`/pilots/${p.id}`}
                    sheetHref={`/sheet/pilot/${p.id}`}
                    onDeleteClick={(id, name) => openDeleteDialog('pilot', id, name)}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Mechs */}
          <section aria-labelledby="mechs-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="mechs-heading"
                className="text-xl font-bold uppercase tracking-wide text-[var(--color-su-orange-dark)]"
              >
                Mechs
              </h2>
              <a
                href="/mechs/new"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'no-underline')}
              >
                + Create Mech
              </a>
            </div>
            {mechs.length === 0 ? (
              <EmptyState label="No mechs yet." ctaHref="/mechs/new" ctaLabel="Create Mech" />
            ) : (
              <ul className="flex flex-col gap-2">
                {mechs.map((m) => (
                  <EntityListItem
                    key={m.id}
                    id={m.id}
                    name={m.name}
                    href={`/mechs/${m.id}`}
                    sheetHref={`/sheet/mech/${m.id}`}
                    onDeleteClick={(id, name) => openDeleteDialog('mech', id, name)}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Crawlers */}
          <section aria-labelledby="crawlers-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="crawlers-heading"
                className="text-xl font-bold uppercase tracking-wide text-[var(--color-su-orange-dark)]"
              >
                Crawlers
              </h2>
              <a
                href="/crawlers/new"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'no-underline')}
              >
                + Create Crawler
              </a>
            </div>
            {crawlers.length === 0 ? (
              <EmptyState
                label="No crawlers yet."
                ctaHref="/crawlers/new"
                ctaLabel="Create Crawler"
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {crawlers.map((c) => (
                  <EntityListItem
                    key={c.id}
                    id={c.id}
                    name={c.name}
                    href={`/crawlers/${c.id}`}
                    sheetHref={`/sheet/crawler/${c.id}`}
                    onDeleteClick={(id, name) => openDeleteDialog('crawler', id, name)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

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

type EmptyStateProps = {
  label: string
  ctaHref: string
  ctaLabel: string
}

function EmptyState({ label, ctaHref, ctaLabel }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border py-8 text-center text-muted-foreground">
      <p className="text-sm">{label}</p>
      <a href={ctaHref} className={cn(buttonVariants({ variant: 'default' }), 'no-underline')}>
        {ctaLabel}
      </a>
    </div>
  )
}
