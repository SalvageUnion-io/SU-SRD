/**
 * NewEntityScreen — the mode switch behind every /new route.
 * Router-agnostic so the three routes stay thin and the routing
 * behaviour is testable without a RouterProvider:
 *
 *   mode absent    → the wizard on its first step (r6 F2: `OPENS_ON_FIRST_STEP`;
 *                    false, CreateModeChooser's Guided vs Blank doors)
 *   mode 'guided'  → the EXISTING wizard, rendered unchanged (`wizard` slot)
 *   mode 'blank'   → the Blank dialog open over the wizard (or the chooser)
 *   mode 'pattern' → a mech's patterns (`PatternStart`)
 *
 * Opening on the step, the wizard's head carries the other starts and a kept
 * draft's Continue · Discard (`WizStarts`, provided here).
 *
 * Signed out, the chooser and the guided wizard still run (ADR-034 as
 * amended): a guided build is a session draft, and its Save asks for the
 * account (`SaveSignInDialog`). What writes at once has no draft to keep, so
 * the Blank door and the NPC designer answer with the sign-in panel
 * (`showsSignedOutView`).
 *
 * An NPC has no Blank door (P7 D4): the designer carries its own "Start blank"
 * tile, because a blank NPC made outside it could never gain the actions only
 * the designer picks. `kind="npc"` is the guided wizard at every `mode`.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { ReactNode } from 'react'
import { Fragment, lazy, Suspense, useState } from 'react'
import { GameDataGate } from '../../components/GameDataGate'
import { RoutePending } from '../../components/shared/RouteFallbacks'
import type { CreateMode } from '../../lib/wizard/createMode'
import { drawsWizard, OPENS_ON_FIRST_STEP, shownMode } from '../../lib/wizard/createMode'
import { clearWizardDraft, wizardDraftKey } from '../../lib/wizard/wizardDraft'
import { buildAccountCopy } from '../../messages/build-account'
import { buildWizardCopy } from '../../messages/build-wizard'
import { sharedCopy } from '../../messages/components-shared'
import { useSync } from '../../replica/syncContext'
import { SignInToBuild } from '../account/SignInToBuild'
import { showsSignedOutView } from '../account/signedOutView.model'
import type { WizStarts } from './wizStarts.model'
import { forLine, WizStartsContext } from './wizStarts.model'

/** The doors and the Blank dialog, with the pattern lists they carry: not the guided wizard's to download. */
const CreateDoors = lazy(() => import('./CreateDoors').then((m) => ({ default: m.CreateDoors })))
/** The Blank dialog over the wizard: only after its link is pressed. */
const BlankCreateDialog = lazy(() =>
  import('./BlankCreateDialog').then((m) => ({ default: m.BlankCreateDialog }))
)

type NewEntityScreenProps = {
  kind: SheetKind | 'npc'
  mode: CreateMode
  /** The existing guided wizard — rendered UNCHANGED when mode==='guided'. */
  wizard: ReactNode
  /** Move between modes (routes map this onto the `mode` search param). */
  onModeChange: (mode: CreateMode) => void
  /** A Blank entity was persisted — navigate to its live sheet. */
  onCreated: (id: string) => void
  /**
   * Where signing in from the gate lands: the route's own URL, so a deep link
   * (`?chassis=mule`) survives the Discord round trip. Unset, the site root.
   */
  returnTo?: string
  /** The Game a Blank create lands in (`?game=<id>`, ADR-052 §3); unset, the store decides. */
  gameId?: string | undefined
  /** A mech built for a pilot: that pilot's name, on the chooser. */
  forPilot?: string | undefined
  /** A pilot made for a mech: that mech's name, on the chooser. */
  forMech?: string | undefined
  /** A crawler made from a pilot's or mech's "+ Create": who is assigned to it, on the chooser. */
  forCrew?: string | undefined
  /** `/mechs/new`: the book pattern its deep link names, for the chooser. */
  book?: { chassis?: string | undefined; pattern?: string | undefined } | undefined
}

export function NewEntityScreen({
  kind,
  mode: asked,
  wizard,
  onModeChange,
  onCreated,
  returnTo,
  gameId,
  forPilot,
  forMech,
  forCrew,
  book,
}: NewEntityScreenProps) {
  const connection = useSync()
  const mode = shownMode(asked, kind, book?.pattern)
  // Discarding a kept draft starts the wizard again: a new mount, empty.
  const [run, setRun] = useState(0)
  // A blank sheet and a designed NPC are written at once: they need the account first.
  if (showsSignedOutView(connection.status) && (kind === 'npc' || mode === 'blank')) {
    return <SignInGate kind={kind} returnTo={returnTo} />
  }
  const starts: WizStarts | null =
    kind === 'npc' || !OPENS_ON_FIRST_STEP
      ? null
      : {
          kind,
          signedOut: showsSignedOutView(connection.status),
          forLine: forLine({ forPilot, forMech, forCrew }),
          onStart: onModeChange,
          onDiscard: () => {
            clearWizardDraft(wizardDraftKey(kind))
            // The step it had reached leaves the address too.
            window.history.replaceState(
              window.history.state,
              '',
              window.location.pathname + window.location.search
            )
            setRun((n) => n + 1)
          },
        }

  // The NPC designer is its own `<main>`; a unit's screen is in this one.
  return (
    <GameDataGate fallback={<RoutePending label={sharedCopy('referenceData')} />}>
      {kind === 'npc' ? (
        wizard
      ) : drawsWizard(mode) ? (
        <main>
          <WizStartsContext.Provider value={starts}>
            <Fragment key={run}>{wizard}</Fragment>
          </WizStartsContext.Provider>
          {mode === 'blank' && (
            <Suspense fallback={null}>
              <BlankCreateDialog
                kind={kind}
                open
                onClose={() => onModeChange(undefined)}
                onCreated={onCreated}
                gameId={gameId}
                // A chassis page's Build With This opens a Blank build of it (r5 D8).
                chassis={kind === 'mech' ? book?.chassis : undefined}
              />
            </Suspense>
          )}
        </main>
      ) : (
        // The wait is its own `<main>`, so it stands in for this one.
        <Suspense fallback={<RoutePending />}>
          <main>
            <CreateDoors
              kind={kind}
              mode={mode}
              onModeChange={onModeChange}
              onCreated={onCreated}
              gameId={gameId}
              forPilot={forPilot}
              forMech={forMech}
              forCrew={forCrew}
              book={book}
            />
          </main>
        </Suspense>
      )}
    </GameDataGate>
  )
}

/**
 * The signed-out screen: the sign-in panel, in the `<main>` its band leads.
 * Reads no reference data, so the build draws the NPC designer's into the
 * shell too (`astro/build/signedOutViews.tsx`).
 */
export function SignInGate({ kind, returnTo }: { kind: SheetKind | 'npc'; returnTo?: string }) {
  return (
    <main>
      <SignInToBuild
        title={
          kind === 'npc'
            ? buildWizardCopy('signInToBuildAn')
            : buildWizardCopy('signInToBuildA', { kind })
        }
        redirectTo={returnTo}
        // An NPC's wall says what signing in gives a Mediator (r6 F9).
        {...(kind === 'npc' ? { body: buildAccountCopy('buildYourNpcs') } : {})}
      />
    </main>
  )
}
