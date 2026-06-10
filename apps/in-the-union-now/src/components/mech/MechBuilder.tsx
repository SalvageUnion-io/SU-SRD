/**
 * MechBuilder — chassis-first creation wizard with capacity/scrap/cargo
 * enforcement, mirroring the PilotWizard stepper pattern (design board-mech.jsx).
 *
 * Steps (left stepper rail, Next/Back nav):
 * 1. Chassis  — ChassisSelector
 * 2. Loadout  — SystemModuleGrid + CargoEditor; CapacityIndicator alongside
 * 3. Identity — mech name
 * 4. Review   — summary + Create (MechSchema validates, then entityStore.create)
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
import { makeUnitLot } from '../../lib/schemas/cargoLot'
import type { CargoLot } from '../../lib/schemas/cargoLot'
import { MechSchema } from '../../lib/schemas/mech'
import type { MechSystemSlot, MechModuleSlot, CargoItem } from '../../lib/rules/types'
import { ChassisSelector } from './ChassisSelector'
import { SystemModuleGrid } from './SystemModuleGrid'
import { CargoEditor } from './CargoEditor'
import { CapacityIndicator } from './CapacityIndicator'
import { SavePatternButton } from './Pattern/SavePatternButton'
// TODO(cycle-3): SoftWarningBanner is wired here but is a no-op during create flow
// because there is no entityId until after entityStore.create() resolves.
// Wire the edit flow once /mechs/$id gains an inline editing mode (deferred to a later wave).
import { SoftWarningBanner } from '../shared/SoftWarningBanner'
import { useSoftWarnings } from '../shared/useSoftWarnings'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

type MechBuilderProps = {
  /** Called after entityStore.create() resolves; parent route navigates on success. */
  onSuccess?: () => void
  /**
   * Id of an existing mech being edited. When provided, SoftWarningBanner is active.
   * Omit in create mode (the banner is a no-op until an id exists).
   */
  mechId?: string
  className?: string
}

const MECH_STEPS = ['Chassis', 'Loadout', 'Identity', 'Review'] as const
type MechStep = (typeof MECH_STEPS)[number]

export function MechBuilder({ onSuccess, mechId, className }: MechBuilderProps) {
  const [step, setStep] = useState<MechStep>('Chassis')
  const [mechName, setMechName] = useState('')
  const [chassisName, setChassisName] = useState<string | null>(null)
  const [systems, setSystems] = useState<MechSystemSlot[]>([])
  const [modules, setModules] = useState<MechModuleSlot[]>([])
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentIndex = MECH_STEPS.indexOf(step)

  function canAdvance(): boolean {
    switch (step) {
      case 'Chassis':
        return !!chassisName
      case 'Loadout':
        return true
      case 'Identity':
        return mechName.trim() !== ''
      case 'Review':
        return true
    }
  }

  function goNext() {
    if (currentIndex < MECH_STEPS.length - 1) setStep(MECH_STEPS[currentIndex + 1]!)
  }

  function goBack() {
    if (currentIndex > 0) setStep(MECH_STEPS[currentIndex - 1]!)
  }

  // SoftWarningBanner — active only in edit mode (mechId provided).
  // In create mode (no mechId) the hook returns empty warnings (entity not found).
  const {
    warnings: softWarnings,
    saveAnyway: saveSoftAnyway,
    fixIt: fixSoftWarnings,
  } = useSoftWarnings({
    entityType: 'mech',
    entityId: mechId ?? '',
  })

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

  /**
   * Convert the builder's CargoItem entries to persisted cargo lots
   * (design §2.12). Each entry becomes an atomic unit-lot; explicit
   * slotCount overrides become the lot's units (default 1 — the historical
   * accounting for builder cargo entries).
   */
  function cargoItemsToLots(items: CargoItem[]): CargoLot[] {
    return items.map((item) =>
      item.kind === 'ref'
        ? makeUnitLot(item.ref, { units: item.slotCount ?? 1 })
        : makeUnitLot(item.name, { units: item.slotCount })
    )
  }

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------
  async function handleSubmit() {
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
      const now = new Date().toISOString()
      const rawInput = {
        schemaVersion: 1 as const,
        name: mechName.trim(),
        chassisRef: chassisName,
        systems: systems.map((s) => s.ref),
        modules: modules.map((m) => m.ref),
        cargoLots: cargoItemsToLots(cargoItems),
        conditions: [],
        // Fresh mechs start at full SP/EP from the chassis; Heat starts at 0.
        currentSP: chassis?.structurePoints,
        currentEP: chassis?.energyPoints,
        currentHeat: 0,
      }

      // Validate against MechSchema before submitting (surface errors in-UI)
      const validation = MechSchema.safeParse({
        ...rawInput,
        id: 'temp-validate-only',
        createdAt: now,
        updatedAt: now,
      })
      if (!validation.success) {
        const messages = validation.error.issues
          .map((e: { message: string }) => e.message)
          .join('; ')
        setSubmitError(`Validation error: ${messages}`)
        setIsSubmitting(false)
        return
      }

      await useEntityStore.getState().create('mech', rawInput)
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
    <div className={cn('mx-auto max-w-7xl', className)}>
      <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
        {/* Progress indicator — vertical stepper rail on desktop, horizontal on mobile */}
        <nav aria-label="Wizard steps" className="mb-6 lg:mb-0">
          <p className="mb-3 hidden font-cond text-xs font-bold uppercase tracking-widest text-su-orange-dark lg:block">
            New Mech
          </p>
          <ol className="flex items-center gap-1 text-xs lg:sticky lg:top-4 lg:flex-col lg:items-stretch lg:gap-0.5">
            {MECH_STEPS.map((s, i) => {
              const isDone = i < currentIndex
              const isActive = s === step
              return (
                <li
                  key={s}
                  className={[
                    'flex items-center gap-2 rounded px-2 py-1 lg:px-3 lg:py-2',
                    isActive
                      ? 'border-l-[3px] border-su-orange-dark bg-su-blue-pale font-cond font-bold text-su-black'
                      : isDone
                        ? 'font-cond text-su-black opacity-70'
                        : 'font-cond text-su-grey-dark opacity-40',
                  ].join(' ')}
                >
                  <span className="hidden font-cond font-bold lg:inline">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{s}</span>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* Content column */}
        <div className="min-w-0 space-y-6">
          <h2 className="text-2xl font-bold tracking-wide">
            {step === 'Chassis' && 'Choose Your Chassis'}
            {step === 'Loadout' && 'Systems, Modules & Cargo'}
            {step === 'Identity' && 'Name Your Mech'}
            {step === 'Review' && 'Review & Create'}
          </h2>

          {/* Chassis */}
          {step === 'Chassis' && (
            <ChassisSelector selectedChassis={chassisName} onSelect={setChassisName} />
          )}

          {/* Loadout — systems/modules + cargo, capacity alongside */}
          {step === 'Loadout' && (
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="flex min-w-0 flex-1 flex-col gap-6">
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
                {chassisName && <CargoEditor items={cargoItems} onChange={setCargoItems} />}
              </div>
              <div className="shrink-0 lg:w-64">
                <CapacityIndicator
                  capacity={capacity}
                  cargoUsed={cargoCapacity.used}
                  cargoMax={cargoMax}
                  cargoViolations={cargoCapacity.violations}
                  className="sticky top-4"
                />
              </div>
            </div>
          )}

          {/* Identity */}
          {step === 'Identity' && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="mech-name"
                className="font-cond text-xs font-semibold uppercase tracking-[0.04em] text-su-black"
              >
                Mech name <span className="text-su-rust">*</span>
              </label>
              <input
                id="mech-name"
                type="text"
                aria-label="Mech name"
                value={mechName}
                onChange={(e) => setMechName(e.target.value)}
                placeholder="e.g. Iron Fist"
                required
                className="rounded border border-su-black bg-white px-3 py-2.5 text-sm text-su-black placeholder:text-su-grey focus:outline-none focus:ring-2 focus:ring-su-orange"
              />
            </div>
          )}

          {/* Review */}
          {step === 'Review' && (
            <div className="space-y-3 rounded-md border-[1.5px] border-su-black bg-white p-5">
              <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
                <dt className="font-cond font-semibold uppercase tracking-wide text-su-ink-soft">
                  Name
                </dt>
                <dd>{mechName.trim() || '—'}</dd>
                <dt className="font-cond font-semibold uppercase tracking-wide text-su-ink-soft">
                  Chassis
                </dt>
                <dd>{chassisName ?? '—'}</dd>
                <dt className="font-cond font-semibold uppercase tracking-wide text-su-ink-soft">
                  Systems
                </dt>
                <dd>{systems.length}</dd>
                <dt className="font-cond font-semibold uppercase tracking-wide text-su-ink-soft">
                  Modules
                </dt>
                <dd>{modules.length}</dd>
                <dt className="font-cond font-semibold uppercase tracking-wide text-su-ink-soft">
                  Cargo
                </dt>
                <dd>{cargoItems.length}</dd>
              </dl>
            </div>
          )}

          {/* Validation violations summary — su-rust instead of raw red */}
          {hasViolations && (
            <div className="rounded-[3px] border border-su-rust bg-su-rust/10 p-3 text-sm text-su-rust">
              <strong>Capacity violations detected.</strong> Review the loadout before saving.
            </div>
          )}

          {/* Submit error */}
          {submitError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {submitError}
            </div>
          )}

          {/* Soft warnings (edit mode only — no-op in create flow) */}
          <SoftWarningBanner
            warnings={softWarnings}
            onSaveAnyway={() => void saveSoftAnyway()}
            onFixIt={fixSoftWarnings}
          />

          {/* Navigation */}
          <div className="flex justify-between border-t border-su-grey-light pt-4">
            <div className="flex gap-2">
              {currentIndex > 0 && (
                <Button type="button" variant="ghost" onClick={goBack} disabled={isSubmitting}>
                  Back
                </Button>
              )}
              {chassisName && (
                <SavePatternButton
                  mechName={mechName.trim() || 'Unnamed Mech'}
                  chassisRef={chassisName}
                  systems={systems.map((s) => s.ref)}
                  modules={modules.map((m) => m.ref)}
                  cargoLots={cargoItemsToLots(cargoItems)}
                />
              )}
            </div>

            {step !== 'Review' ? (
              <Button type="button" onClick={goNext} disabled={!canAdvance()}>
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting || !chassisName || !mechName.trim()}
                aria-label="Create mech"
              >
                {isSubmitting ? 'Creating…' : 'Create Mech'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
