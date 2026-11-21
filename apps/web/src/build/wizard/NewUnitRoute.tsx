import { useLocation, useNavigate } from '@tanstack/react-router'
import type { SheetKind } from 'game-domain/entityKinds'
import { pilotLabel } from 'game-domain/pilotLabel'
import type { ReactNode } from 'react'
import { toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { assignLink } from '../../lib/links/assignLink'
import { pairNewMechInGame } from '../../lib/links/mechlessPilot'
import type { NewUnitSearch } from '../../lib/newUnitRoute'
import { buildWizardCopy } from '../../messages/build-wizard'
import { useUnits } from '../../replica/units'
import { DraftGate } from './DraftGate'
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
  book,
}: {
  kind: SheetKind
  search: NewUnitSearch
  wizard: (props: UnitWizardProps) => ReactNode
  /** `/mechs/new` only: the book pattern its deep link names, for the chooser. */
  book?: { chassis?: string | undefined; pattern?: string | undefined }
}) {
  const navigate = useNavigate()
  const { mode, pilot: pilotId, mech: mechId } = search
  // Signing in from the gate comes back to this same URL, deep-link param and all.
  const returnTo = useLocation({ select: (location) => location.href })
  // A mech built for a pilot (`?pilot=`) lands in that pilot's Game.
  const pilot = useUnits((s) =>
    pilotId === undefined ? undefined : s.pilots.find((p) => p.id === pilotId)
  )
  // A pilot made for a mech (`?mech=`) lands in that mech's Game.
  const mech = useUnits((s) =>
    mechId === undefined ? undefined : s.mechs.find((m) => m.id === mechId)
  )
  const paired = pilot ?? mech
  const game = search.game ?? (typeof paired?.gameId === 'string' ? paired.gameId : undefined)
  // Cancelling goes back to the page the build was started from: the Game's
  // page (`?game=`), or the Training Bay.
  const goBack = useWizardReturn(search.game)
  // A mech built in a Game by a member with one mech-less pilot there is that
  // pilot's: assigned at once, with the way back in the notice. Two such
  // pilots and nobody can say whose, so the Crew's own "Assign" asks.
  const pairInGame = (mechId: string) => {
    if (kind !== 'mech' || search.game === undefined) return
    pairNewMechInGame(mechId, search.game).then(
      (paired) => {
        if (paired === null) return
        const mech = useUnits.getState().mechs.find((m) => m.id === mechId)
        toast.success(
          buildWizardCopy('mechAssignedTo', {
            mech: mech?.name ?? buildWizardCopy('theMech'),
            pilot: pilotLabel(paired.pilot),
          }),
          {
            action: {
              label: buildWizardCopy('undo'),
              onClick: () =>
                void paired
                  .undo()
                  .catch((err: unknown) =>
                    toast.error(failureMessage(err, buildWizardCopy('couldNotUndo')))
                  ),
            },
          }
        )
      },
      // Unassigned is where it would have stood anyway; say it is not paired.
      (err: unknown) => toast.error(failureMessage(err, buildWizardCopy('mechNotPaired')))
    )
  }
  // Finishing: a mech built for a pilot is assigned to it, then the pilot's
  // page shows the pair (and a pilot made for a mech, the mech's); a build started from a Game goes back to its page;
  // otherwise the new sheet opens, its Related units offering Assign.
  const handleComplete = (id?: string) => {
    if (id === undefined) return goBack()
    if (mech !== undefined) {
      // The pilot made for a mech takes its seat, and the mech's page shows the pair.
      assignLink({ type: 'mech', id: mech.id }, { type: 'pilot', id }).then(
        () => void navigate({ to: '/mechs/$id', params: { id: mech.id } }),
        (err: unknown) => {
          toast.error(failureMessage(err, buildWizardCopy('pilotNotGivenTo', { name: mech.name })))
          void navigate({ to: '/pilots/$id', params: { id } })
        }
      )
      return
    }
    if (pilot === undefined) {
      pairInGame(id)
      if (search.game !== undefined) return goBack()
      return void navigate({ to: SHEET_PATH[kind], params: { id } })
    }
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
      forMech={mech?.name}
      book={book}
      wizard={
        // A link's pick against a kept draft's is asked before the wizard opens.
        <DraftGate
          kind={kind}
          picks={search as NewUnitSearch<'class' | 'chassis' | 'pattern' | 'type'>}
          onResume={() =>
            void navigate({
              to: NEW_PATH[kind],
              search: { mode: 'guided', game: search.game, pilot: pilotId, mech: mechId },
              replace: true,
            })
          }
        >
          <UnitWizard
            render={wizard}
            onComplete={handleComplete}
            onCancel={goBack}
            gameId={game}
            onOffRules={() =>
              void navigate({
                to: NEW_PATH[kind],
                search: { mode: 'blank', game: search.game, pilot: pilotId, mech: mechId },
              })
            }
          />
        </DraftGate>
      }
      onModeChange={(next) =>
        void navigate({ to: NEW_PATH[kind], search: (prev) => ({ ...prev, mode: next }) })
      }
      onCreated={(id) => {
        if (paired !== undefined) return handleComplete(id)
        pairInGame(id)
        void navigate({ to: SHEET_PATH[kind], params: { id } })
      }}
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
