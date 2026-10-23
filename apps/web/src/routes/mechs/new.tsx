import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { MechWizard } from '../../build/mech/MechWizard'
import { NewEntityScreen } from '../../build/wizard/NewEntityScreen'
import { useWizardReturn } from '../../build/wizard/useWizardReturn'
import { areaTitle } from '../../lib/pageTitle'
import type { CreateMode } from '../../lib/wizard/createMode'
import { parseCreateMode } from '../../lib/wizard/createMode'
import { parseGameParam } from '../../lib/wizard/fromGame'
import { parseSlugParam, preselectedChassis, preselectedPattern } from '../../lib/wizard/preselect'

export const Route = createFileRoute('/mechs/new')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, 'New Mech') }] }),
  // mode: absent → chooser · 'guided' → the wizard · 'blank' → blank dialog
  // chassis: a slug deep-linked from an SRD page's "Build With This" (`lib/wizard/preselect.ts`)
  // pattern: that chassis's pattern slug, from an SRD pattern page's "Build With This"
  // game: the Game it lands in, from that Game's page in Play (`lib/wizard/fromGame.ts`)
  validateSearch: (
    search: Record<string, unknown>
  ): { mode: CreateMode; game?: string | undefined; chassis?: string; pattern?: string } => {
    const chassisSlug = parseSlugParam(search.chassis)
    const patternSlug = parseSlugParam(search.pattern)
    const game = parseGameParam(search.game)
    return {
      mode: parseCreateMode(search.mode),
      // Always set: the root keeps the raw query, so an invalid `game` must be overwritten.
      game,
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
  // the Game's page in Play (`?game=`), or the Training Bay.
  const handleComplete = useWizardReturn(search.game)
  const handleCancel = handleComplete

  return (
    <main>
      <NewEntityScreen
        kind="mech"
        mode={mode}
        returnTo={returnTo}
        gameId={search.game}
        wizard={
          <MechWizard
            onComplete={handleComplete}
            onCancel={handleCancel}
            gameId={search.game}
            preselectChassis={preselectedChassis(search.chassis)}
            preselectPattern={preselectedPattern(search.chassis, search.pattern)}
            onOffRules={() =>
              void navigate({ to: '/mechs/new', search: { mode: 'blank', game: search.game } })
            }
          />
        }
        onModeChange={(next) =>
          void navigate({ to: '/mechs/new', search: (prev) => ({ ...prev, mode: next }) })
        }
        onCreated={(id) => void navigate({ to: '/mechs/$id', params: { id } })}
      />
    </main>
  )
}
