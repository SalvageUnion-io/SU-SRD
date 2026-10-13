/**
 * InstantiateFromPattern — creates a fresh Mech from a MechPattern.
 *
 * The new mech is `mechFromPattern`'s: the pattern's chassis and
 * loadout under the pattern's name, full SP/EP from the chassis, Heat 0, an
 * empty hold — a mech built from a pattern starts fresh — and the pattern it
 * came from in `sourcePattern`, which the pattern page counts. The db
 * layer gives it a fresh id and timestamps.
 *
 * Enforcement regime: NONE, deliberately —
 * instantiate is a Blank-family shortcut and its write path is untouched.
 * It adds PRESENTATION only: saved MechPatterns carry no stored
 * `legalStarting` data tag (the flag is never computed — project data
 * convention), so the confirm dialog names the freeform nature before
 * stamping the mech.
 */

import { Button, FieldError, ModalShell, tokens } from 'component-lib'
import type { MechPattern } from 'itun-domain/schemas/pattern'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useServerAction } from '../../../lib/connection/useServerAction'
import { mechFromPattern } from '../../../lib/patterns/patterns'
import { useEntityStore } from '../../../stores/entityStore'
import '../../../styles/wizard.css'
import {
  dialogActionsStyle,
  dialogBodyStyle,
  dialogNoteStyle,
} from '../../wizard/wizardStyles.model'

const ROOT = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[4],
} satisfies CSSProperties

type InstantiateFromPatternProps = {
  pattern: MechPattern
  /** Called with the new mech id after entityStore.create resolves. */
  onSuccess: (mechId: string) => void
}

export function InstantiateFromPattern({ pattern, onSuccess }: InstantiateFromPatternProps) {
  const [confirming, setConfirming] = useState(false)
  const build = useServerAction(
    () => useEntityStore.getState().create('mech', mechFromPattern(pattern)),
    { failure: 'The mech could not be built from this pattern. Try again.' }
  )
  const { pending: isInstantiating, error } = build

  async function handleInstantiate() {
    const result = await build.run()
    if (result.ok) onSuccess(result.value.id)
  }

  return (
    <div style={ROOT}>
      <Button
        type="button"
        size="compact"
        onClick={() => setConfirming(true)}
        disabled={isInstantiating}
        aria-label={`Build this mech from ${pattern.name}`}
      >
        {isInstantiating ? 'Building…' : 'Build this mech'}
      </Button>
      <ModalShell
        open={confirming}
        onOpenChange={(next) => {
          if (!next) setConfirming(false)
        }}
        title={`Build a mech from ${pattern.name}?`}
        maxWidth="wiz-modal-md"
      >
        <div style={dialogBodyStyle}>
          <div style={dialogNoteStyle}>
            This may exceed the starting rules — a freeform build, like Blank. It stamps the mech
            exactly as saved; edit freely on its live sheet.
          </div>
          <div style={dialogActionsStyle}>
            <Button variant="ghost" size="compact" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="compact"
              onClick={() => {
                setConfirming(false)
                void handleInstantiate()
              }}
            >
              Build
            </Button>
          </div>
        </div>
      </ModalShell>
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}
