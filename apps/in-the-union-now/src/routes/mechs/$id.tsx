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

export const Route = createFileRoute('/mechs/$id')({
  loader: async ({ params }) => {
    await Promise.all([
      useEntityStore.getState().hydrate('mech'),
      useEntityStore.getState().hydrate('pilot'),
      useEntityStore.getState().hydrate('softLink'),
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
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-muted-foreground">Mech not found.</p>
        <a href="/" className="text-sm text-primary underline-offset-2 hover:underline">
          Back to dashboard
        </a>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{mech.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Chassis: {mech.chassisRef}</p>
        </div>
        <a href="/" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          Back
        </a>
      </div>

      {/* Summary */}
      <section className="mb-6 rounded-md border border-border p-4 text-sm">
        <dl className="space-y-2">
          <div className="flex gap-2">
            <dt className="font-medium">Systems:</dt>
            <dd>{mech.systems.length}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Modules:</dt>
            <dd>{mech.modules.length}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Cargo slots used:</dt>
            <dd>{mech.cargo.length}</dd>
          </div>
          {mech.conditions.length > 0 && (
            <div className="flex gap-2">
              <dt className="font-medium">Conditions:</dt>
              <dd>{mech.conditions.join(', ')}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Pilot assignment */}
      <section className="mb-6">
        <h2 className="mb-3 text-base font-semibold">Pilot</h2>
        {pilotLink ? (
          <div className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
            <span className="flex-1 text-muted-foreground">
              Pilot linked: <span className="font-medium text-foreground">{pilotLink.to.id}</span>
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

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href={`/sheet/mech/${id}`}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View Sheet
        </a>
        <a
          href="/mechs/new"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Edit Build
        </a>
      </div>
    </main>
  )
}
