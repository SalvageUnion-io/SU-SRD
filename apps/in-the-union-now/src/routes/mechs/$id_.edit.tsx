/**
 * /mechs/$id/edit — mech edit entry route (plan 3.1).
 *
 * Reuses the MechWizard in edit mode: the stored mech maps onto wizard form
 * state via mechToFormState, and handleSubmit takes the update branch (no
 * duplicate create). The `$id_` segment opts out of nesting under the
 * /mechs/$id detail route.
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'

import { MechWizard } from '../../components/mech/MechWizard'
import { mechToFormState } from '../../lib/wizard/mechFormState'
import { useEntityStore } from '../../stores/entityStore'

export const Route = createFileRoute('/mechs/$id_/edit')({
  loader: async ({ params }) => {
    await Promise.all([
      useEntityStore.getState().hydrate('mech'),
      SalvageUnionReference.preload(['chassis', 'systems', 'modules', 'drones', 'traits']),
    ])
    return { id: params.id }
  },
  component: EditMechRoute,
})

function EditMechRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  const mech = useEntityStore((s) => s.mechs.find((m) => m.id === id) ?? null)

  if (!mech) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-muted-foreground">Mech not found.</p>
        <Link to="/" className="text-sm underline">
          Back to dashboard
        </Link>
      </main>
    )
  }

  function handleComplete(mechId: string) {
    void navigate({ to: '/mechs/$id', params: { id: mechId } })
  }

  function handleCancel() {
    void navigate({ to: '/mechs/$id', params: { id } })
  }

  return (
    <main className="min-h-dvh bg-background">
      <MechWizard
        key={mech.id}
        mechId={mech.id}
        initialState={mechToFormState(mech)}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </main>
  )
}
