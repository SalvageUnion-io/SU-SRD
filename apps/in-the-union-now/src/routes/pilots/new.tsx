import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'
import { PilotWizard } from '../../components/pilot/PilotWizard'
import { NewEntityScreen } from '../../components/wizard/NewEntityScreen'
import { parseCreateMode } from '../../lib/wizard/createMode'
import type { CreateMode } from '../../lib/wizard/createMode'

export const Route = createFileRoute('/pilots/new')({
  // mode: absent → chooser · 'guided' → the wizard · 'blank' → blank dialog
  validateSearch: (search: Record<string, unknown>): { mode: CreateMode } => ({
    mode: parseCreateMode(search.mode),
  }),
  loader: async () => {
    // Preload game data needed by the wizard before rendering
    await SalvageUnionReference.preload(['classes', 'abilities', 'equipment', 'roll-tables'])
    return null
  },
  component: NewPilotRoute,
})

function NewPilotRoute() {
  const navigate = useNavigate()
  const { mode } = Route.useSearch()

  function handleComplete() {
    // Navigate home; Cycle-4 will wire up the dashboard redirect there
    void navigate({ to: '/' })
  }

  function handleCancel() {
    void navigate({ to: '/' })
  }

  return (
    <main>
      <NewEntityScreen
        kind="pilot"
        mode={mode}
        wizard={<PilotWizard onComplete={handleComplete} onCancel={handleCancel} />}
        onModeChange={(next) => void navigate({ to: '/pilots/new', search: { mode: next } })}
        onCreated={(id) => void navigate({ to: '/sheet/$kind/$id', params: { kind: 'pilot', id } })}
      />
    </main>
  )
}
