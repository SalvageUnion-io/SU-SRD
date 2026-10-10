/**
 * InstantiateFromPattern — creates a fresh Mech from a MechPattern.
 *
 * The new mech is `mechFromPattern`'s (issue 1276): the pattern's chassis and
 * loadout under the pattern's name, full SP/EP from the chassis, Heat 0, an
 * empty hold — a mech built from a pattern starts fresh — and the pattern it
 * came from in `sourcePattern` (issue 401), which the pattern page counts. The db
 * layer gives it a fresh id and timestamps.
 *
 * Enforcement regime: NONE, deliberately (wizard-refresh plan §5.2) —
 * instantiate is a Blank-family shortcut and its write path is untouched.
 * Phase 4 adds PRESENTATION only: saved MechPatterns carry no stored
 * `legalStarting` data tag (the flag is never computed — project data
 * convention), so the confirm dialog names the freeform nature before
 * stamping the mech.
 */

import { Button, FieldError, ModalShell } from 'component-lib'
import { useState } from 'react'
import { mechFromPattern } from '../../../lib/patterns/patterns'
import type { MechPattern } from '../../../lib/schemas/pattern'
import { useEntityStore } from '../../../stores/entityStore'

type InstantiateFromPatternProps = {
  pattern: MechPattern
  /** Called with the new mech id after entityStore.create resolves. */
  onSuccess: (mechId: string) => void
}

export function InstantiateFromPattern({ pattern, onSuccess }: InstantiateFromPatternProps) {
  const [confirming, setConfirming] = useState(false)
  const [isInstantiating, setIsInstantiating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleInstantiate() {
    setIsInstantiating(true)
    setError(null)

    try {
      const mech = await useEntityStore.getState().create('mech', mechFromPattern(pattern))
      onSuccess(mech.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mech from pattern.')
      setIsInstantiating(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="compact"
        onClick={() => setConfirming(true)}
        disabled={isInstantiating}
        aria-label={`Instantiate mech from pattern ${pattern.name}`}
      >
        {isInstantiating ? 'Creating…' : 'Instantiate'}
      </Button>
      <ModalShell
        open={confirming}
        onOpenChange={(next) => {
          if (!next) setConfirming(false)
        }}
        title={`Instantiate ${pattern.name}?`}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          <div className="font-body text-sm text-wk-muted">
            This may exceed the starting rules — a freeform build, like Blank. It stamps the mech
            exactly as saved; edit freely on its live sheet.
          </div>
          <div className="flex justify-end gap-2">
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
              Instantiate
            </Button>
          </div>
        </div>
      </ModalShell>
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}
