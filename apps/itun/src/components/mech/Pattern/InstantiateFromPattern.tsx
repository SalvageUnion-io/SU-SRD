/**
 * InstantiateFromPattern — creates a fresh Mech from a MechPattern.
 *
 * Copies the pattern's chassis/systems/modules/cargoLots into a new Mech
 * input (cargo lots get fresh ids), appends ' (from pattern)' to the name,
 * and calls entityStore.create('mech'). The new mech gets a fresh id and
 * fresh timestamps from the db layer, and is seeded with live stats exactly
 * like the MechWizard path (plan 2.3, gap 7): full SP/EP from the chassis
 * and currentHeat 0 — never Heat-at-capacity.
 *
 * Enforcement regime: NONE, deliberately (wizard-refresh plan §5.2) —
 * instantiate is a Blank-family shortcut and its write path is untouched.
 * Phase 4 adds PRESENTATION only: saved MechPatterns carry no stored
 * `legalStarting` data tag (the flag is never computed — project data
 * convention), so the confirm dialog names the freeform nature before
 * stamping the mech.
 */

import { useState } from 'react'
import { findChassisByRef } from '../../../lib/rules/derivedStats'
import { useEntityStore } from '../../../stores/entityStore'
import type { MechPattern } from '../../../lib/schemas/pattern'
import { Button, ModalShell, FieldError } from 'component-lib'

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
      const chassis = findChassisByRef(pattern.chassisRef)
      const mech = await useEntityStore.getState().create('mech', {
        schemaVersion: 1,
        name: `${pattern.name} (from pattern)`,
        chassisRef: pattern.chassisRef,
        systems: [...pattern.systems],
        modules: [...pattern.modules],
        cargoLots: pattern.cargoLots.map((lot) => ({ ...lot, id: crypto.randomUUID() })),
        conditions: [],
        // Fresh mechs start at full SP/EP from the chassis; Heat starts at 0.
        currentSP: chassis?.structurePoints,
        currentEP: chassis?.energyPoints,
        currentHeat: 0,
      })
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
        size="sm"
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
        headerBg="bg-su-orange"
        maxWidth="max-w-md"
        align="center"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          <div className="font-body text-sm text-wk-muted">
            This may exceed the starting rules — a freeform build, like Blank. It stamps the mech
            exactly as saved; edit freely on its live sheet.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
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
