import { useLocation, useNavigate } from '@tanstack/react-router'
import type { SheetKind } from 'game-domain/entityKinds'
import type { ReactNode } from 'react'
import type { NewUnitSearch } from '../../lib/newUnitRoute'
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
  onComplete: () => void
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
  const { mode, game } = search
  // Signing in from the gate comes back to this same URL, deep-link param and all.
  const returnTo = useLocation({ select: (location) => location.href })
  // Finishing or cancelling goes back to the page the build was started from:
  // the Game's page in Play (`?game=`), or the Training Bay.
  const handleComplete = useWizardReturn(game)

  return (
    <main>
      <NewEntityScreen
        kind={kind}
        mode={mode}
        returnTo={returnTo}
        gameId={game}
        wizard={wizard({
          onComplete: handleComplete,
          onCancel: handleComplete,
          gameId: game,
          onOffRules: () => void navigate({ to: NEW_PATH[kind], search: { mode: 'blank', game } }),
        })}
        onModeChange={(next) =>
          void navigate({ to: NEW_PATH[kind], search: (prev) => ({ ...prev, mode: next }) })
        }
        onCreated={(id) => void navigate({ to: SHEET_PATH[kind], params: { id } })}
      />
    </main>
  )
}
