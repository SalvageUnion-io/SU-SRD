/**
 * MechBuilder — chassis-first creation form with capacity/scrap/cargo enforcement.
 *
 * Flow:
 * 1. Pick chassis (ChassisSelector)
 * 2. Select systems + modules (SystemModuleGrid) — capacity recomputed on every change
 * 3. Add cargo items (CargoEditor) — cargo capacity recomputed on every change
 * 4. CapacityIndicator always visible showing usage + violations
 * 5. Auto stand-in pilot preview shown when no pilot is wired
 * 6. On submit: MechSchema validates, then entityStore.create('mech', ...) fires
 *
 * Navigation to dashboard ('/') on success is handled by the route wrapper
 * via the onSuccess prop. MechBuilder is UI-only; it does not import
 * react-router or TanStack Router directly.
 */
import { useState, useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { computeMechCapacity } from '../../lib/rules/capacity'
import { computeCargoCapacity } from '../../lib/rules/cargo'
import { useEntityStore } from '../../stores/entityStore'
import type { MechSystemSlot, MechModuleSlot, CargoItem } from '../../lib/rules/types'
import { ChassisSelector } from './ChassisSelector'
import { SystemModuleGrid } from './SystemModuleGrid'
import { CargoEditor } from './CargoEditor'
import { CapacityIndicator } from './CapacityIndicator'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

type MechBuilderProps = {
  /** Called after entityStore.create() resolves; parent route navigates on success. */
  onSuccess?: () => void
  className?: string
}

export function MechBuilder({ onSuccess, className }: MechBuilderProps) {
  const [mechName, setMechName] = useState('')
  const [chassisName, setChassisName] = useState<string | null>(null)
  const [systems, setSystems] = useState<MechSystemSlot[]>([])
  const [modules, setModules] = useState<MechModuleSlot[]>([])
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ---------------------------------------------------------------------------
  // Resolve chassis for capacity / cargo math
  // ---------------------------------------------------------------------------
  const chassis = useMemo(
    () =>
      chassisName ? SalvageUnionReference.Chassis.find((c) => c.name === chassisName) : undefined,
    [chassisName]
  )

  // ---------------------------------------------------------------------------
  // Live capacity computation
  // ---------------------------------------------------------------------------
  const capacity = useMemo(
    () =>
      computeMechCapacity({
        chassisRef: chassisName ?? '',
        systems,
        modules,
      }),
    [chassisName, systems, modules]
  )

  const cargoCapacity = useMemo(() => {
    const cargoMax = chassis?.cargoCapacity ?? 0
    return computeCargoCapacity({ cargoCapacity: cargoMax }, cargoItems)
  }, [chassis, cargoItems])

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!chassisName) {
      setSubmitError('Please select a chassis before creating the mech.')
      return
    }
    if (!mechName.trim()) {
      setSubmitError('Please enter a name for the mech.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await useEntityStore.getState().create('mech', {
        schemaVersion: 1,
        name: mechName.trim(),
        chassisRef: chassisName,
        systems: systems.map((s) => s.ref),
        modules: modules.map((m) => m.ref),
        cargo: cargoItems.map((item) => (item.kind === 'ref' ? item.ref : item.name)),
        conditions: [],
      })
      onSuccess?.()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create mech.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const hasViolations =
    capacity.violations.length > 0 ||
    cargoCapacity.violations.some((v) => v.kind === 'over-capacity')
  const cargoMax = chassis?.cargoCapacity ?? 0

  return (
    <form onSubmit={handleSubmit} className={cn('flex flex-col gap-6', className)} noValidate>
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold">New Mech</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Build your mech chassis-first with capacity and cargo tracking.
        </p>
      </div>

      {/* Mech name */}
      <div className="flex flex-col gap-1">
        <label htmlFor="mech-name" className="text-sm font-medium">
          Mech name
        </label>
        <input
          id="mech-name"
          type="text"
          aria-label="Mech name"
          value={mechName}
          onChange={(e) => setMechName(e.target.value)}
          placeholder="e.g. Iron Fist"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Main two-column layout: builder + capacity */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: builder panels */}
        <div className="flex flex-col gap-6 flex-1 min-w-0">
          {/* Chassis selector */}
          <ChassisSelector selectedChassis={chassisName} onSelect={setChassisName} />

          {/* Systems + modules grid */}
          <SystemModuleGrid
            chassisName={chassisName}
            selectedSystems={systems}
            selectedModules={modules}
            onSystemsChange={setSystems}
            onModulesChange={setModules}
            systemSlotsUsed={capacity.systemSlotsUsed}
            systemSlotsMax={capacity.systemSlotsMax}
            moduleSlotsUsed={capacity.moduleSlotsUsed}
            moduleSlotsMax={capacity.moduleSlotsMax}
          />

          {/* Cargo editor */}
          {chassisName && <CargoEditor items={cargoItems} onChange={setCargoItems} />}
        </div>

        {/* Right: capacity indicator + pilot stand-in */}
        <div className="flex flex-col gap-4 lg:w-64 shrink-0">
          {/* Capacity indicator */}
          <CapacityIndicator
            capacity={capacity}
            cargoUsed={cargoCapacity.used}
            cargoMax={cargoMax}
            cargoViolations={cargoCapacity.violations}
            className="sticky top-4"
          />

          {/* Auto stand-in pilot preview */}
          <div
            className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground"
            aria-label="Pilot preview"
          >
            <p className="font-medium">[No Pilot Assigned]</p>
            <p className="mt-0.5">Pilot wiring available in a future update.</p>
          </div>
        </div>
      </div>

      {/* Validation violations summary */}
      {hasViolations && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <strong>Capacity violations detected.</strong> Review the indicator on the right before
          saving.
        </div>
      )}

      {/* Submit error */}
      {submitError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      {/* Submit button */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isSubmitting || !chassisName || !mechName.trim()}
          aria-label="Create mech"
        >
          {isSubmitting ? 'Creating…' : 'Create Mech'}
        </Button>
      </div>
    </form>
  )
}
