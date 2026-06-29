import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'
import { PilotWizard } from '../../components/pilot/PilotWizard'

export const Route = createFileRoute('/pilots/new')({
  loader: async () => {
    // Preload game data needed by the wizard before rendering
    await SalvageUnionReference.preload(['classes', 'abilities', 'equipment', 'roll-tables'])
    return null
  },
  component: NewPilotRoute,
})

function NewPilotRoute() {
  const navigate = useNavigate()

  function handleComplete() {
    // Navigate home; Cycle-4 will wire up the dashboard redirect there
    void navigate({ to: '/' })
  }

  function handleCancel() {
    void navigate({ to: '/' })
  }

  return (
    <main>
      <PilotWizard onComplete={handleComplete} onCancel={handleCancel} />
    </main>
  )
}
