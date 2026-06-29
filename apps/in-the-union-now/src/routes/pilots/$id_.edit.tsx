/**
 * /pilots/$id/edit — pilot edit entry route (plan 3.1).
 *
 * Reuses the PilotWizard in edit mode: the stored pilot maps onto wizard
 * form state via pilotToFormState, and handleSubmit takes the update branch
 * (no duplicate create). The `$id_` segment opts out of nesting under the
 * /pilots/$id detail route.
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { PilotWizard } from '../../components/pilot/PilotWizard'
import { pilotToFormState } from '../../lib/wizard/pilotFormState'
import { useEntityStore } from '../../stores/entityStore'

export const Route = createFileRoute('/pilots/$id_/edit')({
  loader: async ({ params }) => {
    await useEntityStore.getState().hydrate('pilot')
    return { id: params.id }
  },
  component: EditPilotRoute,
})

function EditPilotRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  const pilot = useEntityStore((s) => s.pilots.find((p) => p.id === id) ?? null)

  if (!pilot) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <p className="text-wk-muted">Pilot not found.</p>
        <Link to="/" className="text-sm underline">
          Back to dashboard
        </Link>
      </main>
    )
  }

  function handleComplete(pilotId: string) {
    void navigate({ to: '/pilots/$id', params: { id: pilotId } })
  }

  function handleCancel() {
    void navigate({ to: '/pilots/$id', params: { id } })
  }

  return (
    <main>
      <PilotWizard
        key={pilot.id}
        pilotId={pilot.id}
        initialState={pilotToFormState(pilot)}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </main>
  )
}
