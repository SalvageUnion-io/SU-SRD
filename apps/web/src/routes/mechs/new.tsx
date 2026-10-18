import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { useReturnToContainer } from '../../build/entityContainer/useShowContainer'
import { MechWizard } from '../../build/mech/MechWizard'
import { NewEntityScreen } from '../../build/wizard/NewEntityScreen'
import { areaTitle } from '../../lib/pageTitle'
import type { CreateMode } from '../../lib/wizard/createMode'
import { parseCreateMode } from '../../lib/wizard/createMode'
import { parseSlugParam, preselectedChassis, preselectedPattern } from '../../lib/wizard/preselect'

export const Route = createFileRoute('/mechs/new')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, 'New Mech') }] }),
  // mode: absent → chooser · 'guided' → the wizard · 'blank' → blank dialog
  // chassis: a slug deep-linked from an SRD page's "Build With This" (`lib/wizard/preselect.ts`)
  // pattern: that chassis's pattern slug, from an SRD pattern page's "Build With This"
  validateSearch: (
    search: Record<string, unknown>
  ): { mode: CreateMode; chassis?: string; pattern?: string } => {
    const chassisSlug = parseSlugParam(search.chassis)
    const patternSlug = parseSlugParam(search.pattern)
    return {
      mode: parseCreateMode(search.mode),
      ...(chassisSlug ? { chassis: chassisSlug } : {}),
      ...(patternSlug ? { pattern: patternSlug } : {}),
    }
  },
  // No loader: the wizard renders inside GameDataReady, whose preload('all')
  // is already the gate for every route, so a per-route preload list here was
  // pure repetition.
  component: NewMechRoute,
})

function NewMechRoute() {
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
        kind="mech"
        mode={mode}
        returnTo={returnTo}
        wizard={
          <MechWizard
            onComplete={handleComplete}
            onCancel={handleCancel}
            preselectChassis={preselectedChassis(search.chassis)}
            preselectPattern={preselectedPattern(search.chassis, search.pattern)}
            onOffRules={() => void navigate({ to: '/mechs/new', search: { mode: 'blank' } })}
          />
        }
        onModeChange={(next) =>
          void navigate({ to: '/mechs/new', search: (prev) => ({ ...prev, mode: next }) })
        }
        onCreated={(id) => void navigate({ to: '/sheet/$kind/$id', params: { kind: 'mech', id } })}
      />
    </main>
  )
}
