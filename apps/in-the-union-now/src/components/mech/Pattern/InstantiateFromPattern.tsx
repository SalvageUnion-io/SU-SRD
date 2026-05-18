/**
 * InstantiateFromPattern — creates a fresh Mech from a MechPattern.
 *
 * Copies the pattern's chassis/systems/modules/cargo into a new Mech input,
 * appends ' (from pattern)' to the name, and calls entityStore.create('mech').
 * The new mech gets a fresh id and fresh timestamps from the db layer.
 *
 * onSuccess is called with the new mech id so the parent route can navigate.
 */

import { useState } from 'react'
import { useEntityStore } from '../../../stores/entityStore'
import type { MechPattern } from '../../../lib/schemas/pattern'
import { Button } from '../../ui/button'

type InstantiateFromPatternProps = {
  pattern: MechPattern
  /** Called with the new mech id after entityStore.create resolves. */
  onSuccess: (mechId: string) => void
}

export function InstantiateFromPattern({ pattern, onSuccess }: InstantiateFromPatternProps) {
  const [isInstantiating, setIsInstantiating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleInstantiate() {
    setIsInstantiating(true)
    setError(null)

    try {
      const mech = await useEntityStore.getState().create('mech', {
        schemaVersion: 1,
        name: `${pattern.name} (from pattern)`,
        chassisRef: pattern.chassisRef,
        systems: [...pattern.systems],
        modules: [...pattern.modules],
        cargo: [...pattern.cargo],
        conditions: [],
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
        variant="outline"
        size="sm"
        onClick={() => void handleInstantiate()}
        disabled={isInstantiating}
        aria-label={`Instantiate mech from pattern ${pattern.name}`}
      >
        {isInstantiating ? 'Creating…' : 'Instantiate'}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
