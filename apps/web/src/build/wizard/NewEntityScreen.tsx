/**
 * NewEntityScreen — the mode switch behind every /new route.
 * Router-agnostic so the three routes stay thin and the routing
 * behaviour is testable without a RouterProvider:
 *
 *   mode absent   → CreateModeChooser (Guided vs Blank doors)
 *   mode 'guided' → the EXISTING wizard, rendered unchanged (`wizard` slot)
 *   mode 'blank'  → the chooser with the Blank dialog open over it
 *
 * Signed out, none of these: building needs an account (ADR-034 as amended),
 * so the visitor gets the sign-in panel instead of a wizard whose last step
 * would be refused.
 *
 * An NPC has no Blank door (P7 D4): the designer carries its own "Start blank"
 * tile, because a blank NPC made outside it could never gain the actions only
 * the designer picks. `kind="npc"` is the guided wizard at every `mode`.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { ReactNode } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
import type { CreateMode } from '../../lib/wizard/createMode'
import { SignInToBuild } from '../account/SignInToBuild'
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
}

export function NewEntityScreen({
  kind,
  mode,
  wizard,
  onModeChange,
  onCreated,
  returnTo,
  gameId,
}: NewEntityScreenProps) {
  const connection = useConnection()
  if (connection.mode === 'solo') {
    // Not a PageShell: the routes already wrap this screen in their `<main>`,
    // and the gate's band runs its full width. The NPC route draws none (its
    // designer is its own `<main>`), so its gate brings one: without it the
    // band is not the page's leading band and the Union bar stays ink above it.
    const gate = (
      <SignInToBuild
        title={kind === 'npc' ? 'Sign in to build an NPC' : `Sign in to build a ${kind}`}
        redirectTo={returnTo}
      />
    )
    return kind === 'npc' ? <main>{gate}</main> : gate
  }

  if (mode === 'guided' || kind === 'npc') {
    return <>{wizard}</>
  }

  return (
    <>
      <CreateModeChooser
        kind={kind}
        onGuided={() => onModeChange('guided')}
        onBlank={() => onModeChange('blank')}
        gameId={gameId}
      />
      <BlankCreateDialog
        kind={kind}
        open={mode === 'blank'}
        onClose={() => onModeChange(undefined)}
        onCreated={onCreated}
        gameId={gameId}
      />
    </>
  )
}
