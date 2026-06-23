/**
 * PatternSnapshotView — read-only view of a published Mech Pattern snapshot,
 * with a "Clone to my builds" action (REQ-026 / M4).
 *
 * Patterns aren't a sheet kind, so a published pattern doesn't render through
 * the Sheet shell. Instead we show a compact read-only summary of the template
 * (chassis · systems · modules · cargo) and offer a single action that
 * instantiates the pattern into the visitor's own IndexedDB as a fresh Mech —
 * reusing the exact instantiate path the local PatternList uses
 * (entityStore.create('mech') seeded with full SP/EP and currentHeat 0). On
 * success the visitor is navigated to the new build.
 *
 * The clone writes only to the visitor's local store; the snapshot itself is
 * never mutated.
 */

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'

import { findChassisByRef } from '../../lib/rules/derivedStats'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { MechPattern } from '../../lib/schemas/pattern'
import { useEntityStore } from '../../stores/entityStore'
import { Button } from '../ui/button'
import { AppLink } from '../shared/AppLink'

type PatternSnapshotViewProps = {
  pattern: MechPattern
}

export function PatternSnapshotView({ pattern }: PatternSnapshotViewProps) {
  const navigate = useNavigate()
  const [isCloning, setIsCloning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chassis = SalvageUnionReference.Chassis.find((c) => c.name === pattern.chassisRef) ?? null

  async function handleClone() {
    setIsCloning(true)
    setError(null)
    try {
      // Mirror InstantiateFromPattern: fresh id/timestamps from the db layer,
      // fresh cargo-lot ids, full SP/EP from the chassis, Heat at 0.
      const chassisStats = findChassisByRef(pattern.chassisRef)
      const mech = await useEntityStore.getState().create('mech', {
        schemaVersion: 1,
        name: `${pattern.name} (from pattern)`,
        chassisRef: pattern.chassisRef,
        systems: [...pattern.systems],
        modules: [...pattern.modules],
        cargoLots: pattern.cargoLots.map((lot) => ({ ...lot, id: crypto.randomUUID() })),
        conditions: [],
        currentSP: chassisStats?.structurePoints,
        currentEP: chassisStats?.energyPoints,
        currentHeat: 0,
      })
      void navigate({ to: '/mechs/$id', params: { id: mech.id } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone pattern to your builds.')
      setIsCloning(false)
    }
  }

  return (
    <div>
      {/* Snapshot banner — makes read-only context clear */}
      <div
        role="note"
        aria-label="Read-only snapshot"
        className="border-b-2 border-ink bg-su-sickly-yellow px-4 py-2 font-body text-sm font-semibold text-ink sm:px-[30px]"
      >
        This is a read-only mech pattern snapshot. Clone it to make an editable build of your own.
      </div>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mech Pattern
          </p>
          <h1 className="text-2xl font-bold">{pattern.name}</h1>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Chassis
            </dt>
            <dd className="text-sm">{chassis?.name ?? pattern.chassisRef}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cargo
            </dt>
            <dd className="text-sm">{totalLotUnits(pattern.cargoLots)} units</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Systems
            </dt>
            <dd className="text-sm">
              {pattern.systems.length > 0 ? pattern.systems.join(', ') : 'None'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Modules
            </dt>
            <dd className="text-sm">
              {pattern.modules.length > 0 ? pattern.modules.join(', ') : 'None'}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col items-start gap-2">
          <Button
            type="button"
            onClick={() => void handleClone()}
            disabled={isCloning}
            aria-label={`Clone pattern ${pattern.name} to my builds`}
          >
            {isCloning ? 'Cloning…' : 'Clone to my builds'}
          </Button>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <AppLink href="/" className="text-sm underline">
            &larr; Back to dashboard
          </AppLink>
        </div>
      </main>
    </div>
  )
}
