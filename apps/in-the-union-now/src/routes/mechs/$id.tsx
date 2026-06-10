/**
 * /mechs/$id — minimal mech detail route.
 *
 * Hydrates entityStore on load, reads the mech by id.
 * Renders: name, chassis ref, system/module counts, wiring affordances.
 * Links to the sheet view (cycle-1) and the mech builder for edits.
 *
 * 404 rendered inline when the mech is not found after hydration.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { useEntityStore } from '../../stores/entityStore'
import { AssignPilotToMech } from '../../components/wiring/AssignPilotToMech'
import { UnassignLinkButton } from '../../components/wiring/UnassignLinkButton'
import { useSoftLinks } from '../../components/wiring/useSoftLinks'
import { AssignToWorkspaceButton } from '../../components/workspace/AssignToWorkspaceButton'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { buttonVariants } from '../../components/ui/buttonVariants'
import { cn } from '../../lib/utils'
import { ExportEntityButton } from '../../components/export/ExportEntityButton'

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
      <main className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-muted-foreground">Mech not found.</p>
        <a href="/" className={cn(buttonVariants({ variant: 'link', size: 'sm' }))}>
          Back to dashboard
        </a>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-cond text-2xl font-bold uppercase tracking-wide text-su-black">
            {mech.name}
          </h1>
          <p className="mt-1 font-cond text-xs font-semibold uppercase tracking-widest text-su-ink-soft">
            Chassis: {mech.chassisRef}
          </p>
        </div>
        <a
          href="/"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
        >
          Back
        </a>
      </div>

      {/* 2-pane at lg+: left = summary/stats, right = wiring/actions */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left pane — mech stats summary */}
        <div className="min-w-0 flex-1">
          <section className="mb-6 rounded-sm border border-su-black bg-white p-4 text-sm">
            <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-widest text-su-black">
              Stats
            </h2>
            <dl className="space-y-2">
              <div className="flex gap-2">
                <dt className="font-cond font-semibold uppercase tracking-wide text-su-ink-soft">
                  Systems:
                </dt>
                <dd>{mech.systems.length}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-cond font-semibold uppercase tracking-wide text-su-ink-soft">
                  Modules:
                </dt>
                <dd>{mech.modules.length}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-cond font-semibold uppercase tracking-wide text-su-ink-soft">
                  Cargo slots used:
                </dt>
                <dd>{mech.cargoLots.length}</dd>
              </div>
              {mech.conditions.length > 0 && (
                <div className="flex gap-2">
                  <dt className="font-cond font-semibold uppercase tracking-wide text-su-ink-soft">
                    Conditions:
                  </dt>
                  <dd>{mech.conditions.join(', ')}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>

        {/* Right pane — wiring + actions */}
        <div className="w-full shrink-0 space-y-6 lg:w-72">
          {/* Pilot assignment */}
          <section className="rounded-sm border border-su-black bg-white p-4">
            <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-widest text-su-black">
              Pilot
            </h2>
            {pilotLink ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="flex-1 text-muted-foreground">
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
                <p className="text-sm text-muted-foreground">No pilot assigned.</p>
                <AssignPilotToMech
                  mechId={id}
                  onAssigned={() => void navigate({ to: '/mechs/$id', params: { id } })}
                />
              </div>
            )}
          </section>

          {/* Workspace assignment */}
          <section className="rounded-sm border border-su-black bg-white p-4">
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
            <a
              href={`/sheet/mech/${id}`}
              className={cn(buttonVariants({ variant: 'default' }), 'no-underline')}
            >
              View Sheet
            </a>
            <ExportEntityButton type="mech" id={id} name={mech.name} />
          </div>
        </div>
      </div>
    </main>
  )
}
