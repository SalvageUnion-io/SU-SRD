import { useLocation, useNavigate } from '@tanstack/react-router'
import type { SheetKind } from 'game-domain/entityKinds'
import type { ReactNode } from 'react'
import { toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { assignLink } from '../../lib/links/assignLink'
import type { NewUnitSearch } from '../../lib/newUnitRoute'
import { buildWizardCopy } from '../../messages/build-wizard'
import { useUnits } from '../../replica/units'
import { NewEntityScreen } from './NewEntityScreen'
import { useWizardReturn } from './useWizardReturn'

const NEW_PATH = {
  pilot: '/pilots/new',
  mech: '/mechs/new',
  crawler: '/crawlers/new',
} as const satisfies Record<SheetKind, string>

const SHEET_PATH = {
  pilot: '/pilots/$id',
  mech: '/mechs/$id',
  crawler: '/crawlers/$id',
} as const satisfies Record<SheetKind, string>

/** What every unit wizard takes from its route. */
export type UnitWizardProps = {
  /** The new unit's id, when the wizard has it (the mech wizard does). */
  onComplete: (id?: string) => void
  onCancel: () => void
  gameId: string | undefined
  onOffRules: () => void
}

/** The page body of `/pilots/new`, `/mechs/new` and `/crawlers/new`. */
export function NewUnitRoute({
  kind,
  search,
  wizard,
}: {
  kind: SheetKind
  search: NewUnitSearch
  wizard: (props: UnitWizardProps) => ReactNode
}) {
  const navigate = useNavigate()
  const { mode, pilot: pilotId } = search
  // Signing in from the gate comes back to this same URL, deep-link param and all.
  const returnTo = useLocation({ select: (location) => location.href })
  // A mech built for a pilot (`?pilot=`) lands in that pilot's Game.
  const pilot = useUnits((s) =>
    pilotId === undefined ? undefined : s.pilots.find((p) => p.id === pilotId)
  )
  const game = search.game ?? (typeof pilot?.gameId === 'string' ? pilot.gameId : undefined)
  // Cancelling goes back to the page the build was started from: the Game's
  // page (`?game=`), or the Training Bay.
  const goBack = useWizardReturn(search.game)
  // Finishing: a mech built for a pilot is assigned to it, then the pilot's
  // page shows the pair; otherwise back where the build started.
  const handleComplete = (id?: string) => {
    if (pilot === undefined || id === undefined) return goBack()
    assignLink({ type: 'mech', id }, { type: 'pilot', id: pilot.id }).then(
      () => void navigate({ to: '/pilots/$id', params: { id: pilot.id } }),
      (err: unknown) => {
        toast.error(failureMessage(err, buildWizardCopy('mechNotGivenTo', { name: pilot.name })))
        void navigate({ to: '/mechs/$id', params: { id } })
      }
    )
  }

  return (
    <NewEntityScreen
      kind={kind}
      mode={mode}
      returnTo={returnTo}
      gameId={game}
      forPilot={pilot?.name}
      wizard={
        <UnitWizard
          render={wizard}
          onComplete={handleComplete}
          onCancel={goBack}
          gameId={game}
          onOffRules={() =>
            void navigate({
              to: NEW_PATH[kind],
              search: { mode: 'blank', game: search.game, pilot: pilotId },
            })
          }
        />
      }
      onModeChange={(next) =>
        void navigate({ to: NEW_PATH[kind], search: (prev) => ({ ...prev, mode: next }) })
      }
      onCreated={(id) =>
        pilot === undefined
          ? void navigate({ to: SHEET_PATH[kind], params: { id } })
          : handleComplete(id)
      }
    />
  )
}

/**
 * The route's wizard, drawn when it renders rather than when the route does:
 * a route reads its deep link's pick from the reference data (`preselect`),
 * which `NewEntityScreen` waits for.
 */
function UnitWizard({
  render,
  ...props
}: UnitWizardProps & { render: (props: UnitWizardProps) => ReactNode }) {
  return render(props)
}
