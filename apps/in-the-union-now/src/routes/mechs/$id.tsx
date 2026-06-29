/**
 * /mechs/$id — minimal mech detail route.
 *
 * Hydrates entityStore on load, reads the mech by id.
 * Renders: name, chassis ref, system/module counts, the installed loadout as
 * compact entity cards (gap 24), wiring affordances.
 * Links to the sheet view and the edit wizard (/mechs/$id/edit).
 *
 * 404 rendered inline when the mech is not found after hydration.
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import type { SURefModule, SURefSystem } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'

import { useEntityStore } from '../../stores/entityStore'
import { AssignPilotToMech } from '../../components/wiring/AssignPilotToMech'
import { UnassignLinkButton } from '../../components/wiring/UnassignLinkButton'
import { useSoftLinks } from '../../components/wiring/useSoftLinks'
import { AssignToWorkspaceButton } from '../../components/workspace/AssignToWorkspaceButton'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { buttonVariants } from '../../components/ui/buttonVariants'
import { cn } from '../../lib/utils'
import { ExportEntityButton } from '../../components/export/ExportEntityButton'
import { resolveModule, resolveSystem } from '../../components/sheet/mechItemRules'
import type { ItemConditionMap } from '../../lib/schemas/mech'

export const Route = createFileRoute('/mechs/$id')({
  loader: async ({ params }) => {
    await Promise.all([
      useEntityStore.getState().hydrate('mech'),
      useEntityStore.getState().hydrate('pilot'),
      useEntityStore.getState().hydrate('softLink'),
      useWorkspaceStore.getState().hydrate(),
    ])
    return { id: params.id }
  },
  component: MechDetailPage,
})

function MechDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  const mech = useEntityStore((s) => s.mechs.find((m) => m.id === id) ?? null)
  const { outgoing } = useSoftLinks({ entityType: 'mech', entityId: id })

  // Outgoing mech-to-pilot links
  const pilotLink = outgoing.find((l) => l.type === 'mech-to-pilot') ?? null

  if (!mech) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <p className="text-wk-muted">Mech not found.</p>
        <Link to="/" className={cn(buttonVariants({ variant: 'link', size: 'sm' }))}>
          Back to dashboard
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-cond text-2xl font-bold uppercase tracking-wide text-su-black">
            {mech.name}
          </h1>
          <p className="mt-1 font-cond text-xs font-semibold uppercase tracking-widest text-wk-muted">
            Chassis: {mech.chassisRef}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/mechs/$id/edit"
            params={{ id }}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'no-underline')}
          >
            Edit
          </Link>
          <Link
            to="/"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
          >
            Back
          </Link>
        </div>
      </div>

      {/* 2-pane at lg+: left = summary/stats, right = wiring/actions */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left pane — mech stats summary */}
        <div className="min-w-0 flex-1">
          <section className="mb-6 rounded-[3px] border-[1.5px] border-ink bg-paper p-4 text-sm">
            <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-widest text-su-black">
              Stats
            </h2>
            <dl className="space-y-2">
              <div className="flex gap-2">
                <dt className="font-cond font-semibold uppercase tracking-wide text-wk-muted">
                  Systems:
                </dt>
                <dd>{mech.systems.length}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-cond font-semibold uppercase tracking-wide text-wk-muted">
                  Modules:
                </dt>
                <dd>{mech.modules.length}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-cond font-semibold uppercase tracking-wide text-wk-muted">
                  Cargo slots used:
                </dt>
                <dd>{mech.cargoLots.length}</dd>
              </div>
              {mech.conditions.length > 0 && (
                <div className="flex gap-2">
                  <dt className="font-cond font-semibold uppercase tracking-wide text-wk-muted">
                    Conditions:
                  </dt>
                  <dd>{mech.conditions.join(', ')}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Loadout listing (gap 24) — compact entity cards */}
          <LoadoutSection
            title="Systems"
            refs={mech.systems}
            conditions={mech.systemConditions}
            resolve={resolveSystem}
            emptyLabel="No systems installed."
          />
          <LoadoutSection
            title="Modules"
            refs={mech.modules}
            conditions={mech.moduleConditions}
            resolve={resolveModule}
            emptyLabel="No modules installed."
          />
        </div>

        {/* Right pane — wiring + actions */}
        <div className="w-full shrink-0 space-y-6 lg:w-72">
          {/* Pilot assignment */}
          <section className="rounded-[3px] border-[1.5px] border-ink bg-paper p-4">
            <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-widest text-su-black">
              Pilot
            </h2>
            {pilotLink ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="flex-1 text-wk-muted">
                  Pilot linked:{' '}
                  <span className="font-medium text-foreground">{pilotLink.to.id}</span>
                </span>
                <UnassignLinkButton
                  linkId={pilotLink.id}
                  label="Unassign Pilot"
                  onUnassigned={() => void navigate({ to: '/mechs/$id', params: { id } })}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-wk-muted">No pilot assigned.</p>
                <AssignPilotToMech
                  mechId={id}
                  onAssigned={() => void navigate({ to: '/mechs/$id', params: { id } })}
                />
              </div>
            )}
          </section>

          {/* Workspace assignment */}
          <section className="rounded-[3px] border-[1.5px] border-ink bg-paper p-4">
            <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-widest text-su-black">
              Workspace
            </h2>
            <AssignToWorkspaceButton
              entityType="mech"
              entityId={id}
              currentWorkspaceId={mech.workspaceId}
              onChanged={() => void navigate({ to: '/mechs/$id', params: { id } })}
            />
          </section>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Link
              to="/sheet/$kind/$id"
              params={{ kind: 'mech', id }}
              className={cn(buttonVariants({ variant: 'default' }), 'no-underline')}
            >
              View Sheet
            </Link>
            <ExportEntityButton type="mech" id={id} name={mech.name} />
          </div>
        </div>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

type LoadoutSectionProps = {
  title: string
  /** Installed item refs as stored on the mech (slug or name). */
  refs: string[]
  /** Per-item condition map keyed by the same ref. */
  conditions?: ItemConditionMap
  resolve: (ref: string) => SURefSystem | SURefModule | null
  emptyLabel: string
}

/** Installed systems/modules as compact entity cards (gap 24). */
function LoadoutSection({ title, refs, conditions, resolve, emptyLabel }: LoadoutSectionProps) {
  return (
    <section className="mb-6 rounded-[3px] border-[1.5px] border-ink bg-paper p-4">
      <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-widest text-su-black">
        {title} · {refs.length}
      </h2>
      {refs.length === 0 ? (
        <p className="text-sm text-wk-muted">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {refs.map((ref, i) => {
            const entity = resolve(ref)
            if (!entity) {
              return (
                <p key={`${ref}-${i}`} className="font-mono text-xs text-wk-muted">
                  {ref} (unknown reference)
                </p>
              )
            }
            return (
              <ReferenceEntityDisplay
                key={`${ref}-${i}`}
                data={entity}
                compact
                status={conditions?.[ref] ?? 'intact'}
                hide={{ actions: true, choices: true }}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
