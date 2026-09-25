import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MechWizard } from '../../components/mech/MechWizard'
import { NewEntityScreen } from '../../components/wizard/NewEntityScreen'
import type { CreateMode } from '../../lib/wizard/createMode'
import { parseCreateMode } from '../../lib/wizard/createMode'

export const Route = createFileRoute('/mechs/new')({
  // mode: absent → chooser · 'guided' → the wizard · 'blank' → blank dialog
  validateSearch: (search: Record<string, unknown>): { mode: CreateMode } => ({
    mode: parseCreateMode(search.mode),
  }),
  // No loader: the wizard renders inside GameDataReady, whose preload('all')
  // is already the gate for every route, so a per-route preload list here was
  // pure repetition (audit AP-11).
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
