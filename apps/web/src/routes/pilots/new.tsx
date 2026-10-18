import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { useReturnToContainer } from '../../build/entityContainer/useShowContainer'
import { PilotWizard } from '../../build/pilot/PilotWizard'
import { NewEntityScreen } from '../../build/wizard/NewEntityScreen'
import { pageTitle } from '../../lib/pageTitle'
import type { CreateMode } from '../../lib/wizard/createMode'
import { parseCreateMode } from '../../lib/wizard/createMode'
import { parseSlugParam, preselectedClassId } from '../../lib/wizard/preselect'

export const Route = createFileRoute('/pilots/new')({
  head: () => ({ meta: [{ title: pageTitle('New Pilot') }] }),
  // mode: absent → chooser · 'guided' → the wizard · 'blank' → blank dialog
  // class: a slug deep-linked from an SRD page's "Build with this" (`lib/wizard/preselect.ts`)
  validateSearch: (search: Record<string, unknown>): { mode: CreateMode; class?: string } => {
    const classSlug = parseSlugParam(search.class)
    return { mode: parseCreateMode(search.mode), ...(classSlug ? { class: classSlug } : {}) }
  },
  // No loader: the wizard renders inside GameDataReady, whose preload('all')
  // is already the gate for every route, so a per-route preload list here was
  // pure repetition.
  component: NewPilotRoute,
})

function NewPilotRoute() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { mode } = search
  // Signing in from the gate comes back to this same URL, deep-link param and all.
  const returnTo = useLocation({ select: (location) => location.href })

  // Finishing or cancelling goes back to the page the build was started from:
  // a Game's own page, or Shelves.
  const handleComplete = useReturnToContainer()
  const handleCancel = handleComplete

  return (
    <main>
      <NewEntityScreen
        kind="pilot"
        mode={mode}
        returnTo={returnTo}
        wizard={
          <PilotWizard
            onComplete={handleComplete}
            onCancel={handleCancel}
            preselectClassId={preselectedClassId(search.class)}
            onOffRules={() => void navigate({ to: '/pilots/new', search: { mode: 'blank' } })}
          />
        }
        onModeChange={(next) =>
          void navigate({ to: '/pilots/new', search: (prev) => ({ ...prev, mode: next }) })
        }
        onCreated={(id) => void navigate({ to: '/sheet/$kind/$id', params: { kind: 'pilot', id } })}
      />
    </main>
  )
}
