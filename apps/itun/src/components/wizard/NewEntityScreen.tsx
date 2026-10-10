/**
 * NewEntityScreen — the mode switch behind every /new route (wizard-refresh
 * Phase 1). Router-agnostic so the three routes stay thin and the routing
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

import { tokens } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
import type { BlankCreateKind } from '../../lib/wizard/blankCreate'
import type { CreateMode } from '../../lib/wizard/createMode'
import { SignInToBuild } from '../account/SignInToBuild'
import { BlankCreateDialog } from './BlankCreateDialog'
import { CreateModeChooser } from './CreateModeChooser'

const SIGNED_OUT = { padding: `${tokens.space[20]} ${tokens.space[16]}` } satisfies CSSProperties

type NewEntityScreenProps = {
  kind: BlankCreateKind | 'npc'
  mode: CreateMode
  /** The existing guided wizard — rendered UNCHANGED when mode==='guided'. */
  wizard: ReactNode
  /** Move between modes (routes map this onto the `mode` search param). */
  onModeChange: (mode: CreateMode) => void
  /** A Blank entity was persisted — navigate to its live sheet. */
  onCreated: (id: string) => void
}

export function NewEntityScreen({
  kind,
  mode,
  wizard,
  onModeChange,
  onCreated,
}: NewEntityScreenProps) {
  const connection = useConnection()
  if (connection.mode === 'solo') {
    // Not a PageShell: the routes already wrap this screen in their `<main>`.
    return (
      <div style={SIGNED_OUT}>
        <SignInToBuild title={`Sign in to build a ${kind}`} />
      </div>
    )
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
      />
      <BlankCreateDialog
        kind={kind}
        open={mode === 'blank'}
        onClose={() => onModeChange(undefined)}
        onCreated={onCreated}
      />
    </>
  )
}
