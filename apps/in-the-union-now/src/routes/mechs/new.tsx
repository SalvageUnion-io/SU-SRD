import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'
import { MechWizard } from '../../components/mech/MechWizard'
import { NewEntityScreen } from '../../components/wizard/NewEntityScreen'
import { parseCreateMode } from '../../lib/wizard/createMode'
import type { CreateMode } from '../../lib/wizard/createMode'

export const Route = createFileRoute('/mechs/new')({
  // mode: absent → chooser · 'guided' → the wizard · 'blank' → blank dialog
  validateSearch: (search: Record<string, unknown>): { mode: CreateMode } => ({
    mode: parseCreateMode(search.mode),
  }),
  loader: async () => {
    // Preload game data needed by the wizard before rendering
    await SalvageUnionReference.preload(['chassis', 'systems', 'modules', 'drones', 'traits'])
    return null
  },
  component: NewMechRoute,
})

function NewMechRoute() {
  const navigate = useNavigate()
  const { mode } = Route.useSearch()

  function handleComplete() {
    void navigate({ to: '/' })
  }

  function handleCancel() {
    void navigate({ to: '/' })
  }

  return (
    <main>
      <NewEntityScreen
        kind="mech"
        mode={mode}
        wizard={<MechWizard onComplete={handleComplete} onCancel={handleCancel} />}
        onModeChange={(next) => void navigate({ to: '/mechs/new', search: { mode: next } })}
        onCreated={(id) => void navigate({ to: '/sheet/$kind/$id', params: { kind: 'mech', id } })}
      />
    </main>
  )
}
