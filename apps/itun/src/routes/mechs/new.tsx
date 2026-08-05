import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'
import { MechWizard } from '../../components/mech/MechWizard'
import { NewEntityScreen } from '../../components/wizard/NewEntityScreen'
import type { CreateMode } from '../../lib/wizard/createMode'
import { parseCreateMode } from '../../lib/wizard/createMode'

export const Route = createFileRoute('/mechs/new')({
  // mode: absent → chooser · 'guided' → the wizard · 'blank' → blank dialog
  validateSearch: (search: Record<string, unknown>): { mode: CreateMode } => ({
    mode: parseCreateMode(search.mode),
  }),
  loader: async () => {
    // Preload game data needed by the wizard before rendering: actions for
    // the Statistics step's Chassis Ability card, roll-tables for the
    // quirk/appearance/pattern-name d20 assists (pp.94–95 flow, Phase 4).
    await SalvageUnionReference.preload([
      'chassis',
      'systems',
      'modules',
      'drones',
      'traits',
      'actions',
      'roll-tables',
    ])
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
        wizard={
          <MechWizard
            onComplete={handleComplete}
            onCancel={handleCancel}
            onOffRules={() => void navigate({ to: '/mechs/new', search: { mode: 'blank' } })}
          />
        }
        onModeChange={(next) => void navigate({ to: '/mechs/new', search: { mode: next } })}
        onCreated={(id) => void navigate({ to: '/sheet/$kind/$id', params: { kind: 'mech', id } })}
      />
    </main>
  )
}
