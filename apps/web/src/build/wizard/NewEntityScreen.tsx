/**
 * NewEntityScreen — the mode switch behind every /new route.
 * Router-agnostic so the three routes stay thin and the routing
 * behaviour is testable without a RouterProvider:
 *
 *   mode absent   → CreateModeChooser (Guided vs Blank doors)
 *   mode 'guided' → the EXISTING wizard, rendered unchanged (`wizard` slot)
 *   mode 'blank'  → the chooser with the Blank dialog open over it
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
import { GameDataGate } from '../../components/GameDataGate'
import { RoutePending } from '../../components/shared/RouteFallbacks'
import type { CreateMode } from '../../lib/wizard/createMode'
import { buildWizardCopy } from '../../messages/build-wizard'
import { sharedCopy } from '../../messages/components-shared'
import { useSync } from '../../replica/syncContext'
import { SignInToBuild } from '../account/SignInToBuild'
import { showsSignedOutView } from '../account/signedOutView.model'
import { BlankCreateDialog } from './BlankCreateDialog'
import { CreateModeChooser } from './CreateModeChooser'

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
}

export function NewEntityScreen({
  kind,
  mode,
  wizard,
  onModeChange,
  onCreated,
  returnTo,
  gameId,
  forPilot,
}: NewEntityScreenProps) {
  const connection = useSync()
  // A blank sheet and a designed NPC are written at once: they need the account first.
  if (showsSignedOutView(connection.status) && (kind === 'npc' || mode === 'blank')) {
    return <SignInGate kind={kind} returnTo={returnTo} />
  }

  // The NPC designer is its own `<main>`; a unit's screen is in this one.
  return (
    <GameDataGate fallback={<RoutePending label={sharedCopy('referenceData')} />}>
      {kind === 'npc' ? (
        wizard
      ) : (
        <main>
          {mode === 'guided' ? (
            wizard
          ) : (
            <>
              <CreateModeChooser
                kind={kind}
                onGuided={() => onModeChange('guided')}
                onBlank={() => onModeChange('blank')}
                onBuilt={onCreated}
                gameId={gameId}
                forPilot={forPilot}
              />
              <BlankCreateDialog
                kind={kind}
                open={mode === 'blank'}
                onClose={() => onModeChange(undefined)}
                onCreated={onCreated}
                gameId={gameId}
              />
            </>
          )}
        </main>
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
      />
    </main>
  )
}
