import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'
import { MechWizard } from '../../components/mech/MechWizard'

export const Route = createFileRoute('/mechs/new')({
  loader: async () => {
    // Preload game data needed by the wizard before rendering
    await SalvageUnionReference.preload(['chassis', 'systems', 'modules', 'drones', 'traits'])
    return null
  },
  component: NewMechRoute,
})

function NewMechRoute() {
  const navigate = useNavigate()

  function handleComplete() {
    void navigate({ to: '/' })
  }

  function handleCancel() {
    void navigate({ to: '/' })
  }

  return (
    <main>
      <MechWizard onComplete={handleComplete} onCancel={handleCancel} />
    </main>
  )
}
