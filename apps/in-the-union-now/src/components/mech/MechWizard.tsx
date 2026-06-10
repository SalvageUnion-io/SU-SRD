import { useMemo, useState } from 'react'
import { computeMechCapacity } from '../../lib/rules/capacity'
import { findChassisByRef } from '../../lib/rules/derivedStats'
import { evaluateMechWarnings } from '../../lib/rules/softWarnings'
import type { SoftWarning } from '../../lib/rules/types'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import { MechSchema } from '../../lib/schemas/mech'
import {
  EMPTY_MECH_FORM_STATE,
  mechFormToCreateInput,
  mechFormToUpdatePatch,
} from '../../lib/wizard/mechFormState'
import type { MechWizardFormState } from '../../lib/wizard/mechFormState'
import { useEntityStore } from '../../stores/entityStore'
import { SoftWarningBanner } from '../shared/SoftWarningBanner'
import { WizShell } from '../wizard/WizShell'
import { ChassisDetail, ChassisOptionList } from './ChassisStep'
import { InstallStep } from './InstallStep'
import { MechIdentityStep } from './MechIdentityStep'
import { MechReviewStep } from './MechReviewStep'

const STEPS = ['Chassis', 'Systems', 'Modules', 'Identity', 'Review'] as const
type Step = (typeof STEPS)[number]

/** Step heading copy (design §3.2). */
const STEP_TITLES: Record<Step, string> = {
  Chassis: 'Choose Your Chassis',
  Systems: 'Install Systems',
  Modules: 'Install Modules',
  Identity: 'Name Your Mech',
  Review: 'Review',
}

type MechWizardProps = {
  /** Called on successful create/save with the mech's id. */
  onComplete: (mechId: string) => void
  /** Called when the user cancels. */
  onCancel: () => void
  /**
   * Id of an existing mech being edited. When provided, handleSubmit takes
   * the update branch (never duplicates) — plan 3.1.
   */
  mechId?: string
  /**
   * Initial form state — pass `mechToFormState(mech)` in edit mode.
   * Defaults to the empty creation state.
   */
  initialState?: MechWizardFormState
}

/**
 * Multi-step mech wizard on the shared WizShell skeleton (plan 3.2),
 * following the PilotWizard edit-seam architecture exactly (plan 3.1):
 * entity→form mapping lives in lib/wizard/mechFormState.ts, the upsert
 * branch lives in handleSubmit, and step components carry NO edit logic.
 *
 * Capacity is SOFT everywhere (plan 3.4): over-slot/over-cargo selections
 * surface as advisory warnings (budget tracks + banner) and never block
 * navigation or saving.
 */
export function MechWizard({ onComplete, onCancel, mechId, initialState }: MechWizardProps) {
  const isEdit = mechId !== undefined
  const existingMech = useEntityStore((s) =>
    mechId ? (s.mechs.find((m) => m.id === mechId) ?? null) : null
  )

  const [step, setStep] = useState<Step>('Chassis')
  const [form, setForm] = useState<MechWizardFormState>(initialState ?? EMPTY_MECH_FORM_STATE)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentIndex = STEPS.indexOf(step)

  function updateForm(patch: Partial<MechWizardFormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function toggleIn(list: string[], name: string): string[] {
    return list.includes(name) ? list.filter((x) => x !== name) : [...list, name]
  }

  // ---------------------------------------------------------------------------
  // Derived chassis stats + live capacity (soft — warn, never block)
  // ---------------------------------------------------------------------------
  const chassis = useMemo(
    () => (form.chassisName ? findChassisByRef(form.chassisName) : null),
    [form.chassisName]
  )

  const capacity = useMemo(
    () =>
      computeMechCapacity({
        chassisRef: form.chassisName,
        systems: form.systems.map((ref) => ({ ref })),
        modules: form.modules.map((ref) => ({ ref })),
      }),
    [form.chassisName, form.systems, form.modules]
  )

  const cargoMax = (chassis?.cargoCapacity ?? 0) + (existingMech?.maxCargoModifier ?? 0)
  const cargoUsed = totalLotUnits(form.cargoLots)
  const energyMax = (chassis?.energyPoints ?? 0) + (existingMech?.maxEpModifier ?? 0)
  const energyValue = Math.min(existingMech?.currentEP ?? energyMax, energyMax)

  // Live capacity warnings (soft) — shown on every step via the notice slot.
  const capacityWarnings = useMemo<SoftWarning[]>(() => {
    const warnings: SoftWarning[] = capacity.violations
      .filter((v) => v.kind === 'system-over-slots' || v.kind === 'module-over-slots')
      .map((v) => ({
        code: v.kind.toUpperCase().replace(/-/g, '_'),
        message: v.message,
        severity: 'warn',
      }))
    if (cargoMax > 0 && cargoUsed > cargoMax) {
      warnings.push({
        code: 'CARGO_OVER_CAPACITY',
        message: `Cargo capacity exceeded: ${cargoUsed} slots used, ${cargoMax} available.`,
        severity: 'warn',
      })
    }
    return warnings
  }, [capacity.violations, cargoMax, cargoUsed])

  // Pre-save soft warnings (plan 3.4): system-dependency checks against the
  // stored mech. Pure evaluation, advisory only, Review step.
  const softWarnings = useMemo<SoftWarning[]>(() => {
    if (step !== 'Review') return []
    const before = {
      systems: (existingMech?.systems ?? []).map((ref) => ({ ref })),
    }
    const after = { systems: form.systems.map((ref) => ({ ref })) }
    return evaluateMechWarnings({ before, after }, { entityType: 'mech' })
  }, [step, existingMech, form.systems])

  const noticeWarnings = [...capacityWarnings, ...softWarnings]

  function canAdvance(): boolean {
    switch (step) {
      case 'Chassis':
        return form.chassisName !== ''
      case 'Systems':
        return true // installs are optional; capacity is soft
      case 'Modules':
        return true
      case 'Identity':
        return form.name.trim() !== ''
      case 'Review':
        return form.name.trim() !== '' && form.chassisName !== ''
    }
  }

  function goNext() {
    if (step === 'Review') {
      void handleSubmit()
      return
    }
    setStep(STEPS[currentIndex + 1]!)
  }

  function goBack() {
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1]!)
    }
  }

  async function handleSubmit() {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const store = useEntityStore.getState()

      // Upsert branch (plan 3.1): update when editing — NEVER a second create.
      if (mechId) {
        await store.update('mech', mechId, mechFormToUpdatePatch(form))
        onComplete(mechId)
        return
      }

      const now = new Date().toISOString()
      const rawInput = mechFormToCreateInput(form)

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

      const created = await store.create('mech', rawInput)
      onComplete(created.id)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save mech. Please retry.')
      setIsSubmitting(false)
    }
  }

  const loadoutName = form.name.trim() || form.chassisName || 'Mech'

  const subtitle = (() => {
    switch (step) {
      case 'Chassis':
        return 'Choose your chassis. This sets slots, stats, and cargo capacity.'
      case 'Systems':
        return (
          <span data-testid="system-slot-count">
            {capacity.systemSlotsUsed} / {capacity.systemSlotsMax} system slots used · over-capacity
            warns, never blocks
          </span>
        )
      case 'Modules':
        return (
          <span data-testid="module-slot-count">
            {capacity.moduleSlotsUsed} / {capacity.moduleSlotsMax} module slots used · over-capacity
            warns, never blocks
          </span>
        )
      case 'Identity':
        return 'Name your mech and stow any starting cargo.'
      case 'Review':
        return isEdit ? 'Check the changes, then save.' : 'Check the loadout, then create.'
    }
  })()

  return (
    <WizShell
      eyebrow={isEdit ? 'Edit Mech' : 'New Mech'}
      steps={STEPS}
      active={currentIndex}
      onStepClick={(i) => setStep(STEPS[i]!)}
      title={STEP_TITLES[step]}
      subtitle={subtitle}
      optionPane={
        step === 'Chassis' ? (
          <ChassisOptionList
            selectedChassis={form.chassisName}
            onSelect={(chassisName) => updateForm({ chassisName })}
          />
        ) : undefined
      }
      notice={
        noticeWarnings.length > 0 ? <SoftWarningBanner warnings={noticeWarnings} /> : undefined
      }
      onBack={currentIndex > 0 ? goBack : undefined}
      onCancel={onCancel}
      onNext={goNext}
      nextDisabled={!canAdvance()}
      busy={isSubmitting}
      submitLabel={isEdit ? 'Save Mech' : 'Create Mech ✦'}
      ctaFullWidth={step === 'Systems' || step === 'Modules'}
    >
      {step === 'Chassis' && <ChassisDetail chassisName={form.chassisName} />}
      {step === 'Systems' && (
        <InstallStep
          kind="systems"
          selected={form.systems}
          onToggle={(name) => updateForm({ systems: toggleIn(form.systems, name) })}
          loadoutName={loadoutName}
          slotsUsed={capacity.systemSlotsUsed}
          slotsMax={capacity.systemSlotsMax}
          energyValue={energyValue}
          energyMax={energyMax}
        />
      )}
      {step === 'Modules' && (
        <InstallStep
          kind="modules"
          selected={form.modules}
          onToggle={(name) => updateForm({ modules: toggleIn(form.modules, name) })}
          loadoutName={loadoutName}
          slotsUsed={capacity.moduleSlotsUsed}
          slotsMax={capacity.moduleSlotsMax}
          energyValue={energyValue}
          energyMax={energyMax}
        />
      )}
      {step === 'Identity' && (
        <MechIdentityStep
          name={form.name}
          onNameChange={(name) => updateForm({ name })}
          cargoLots={form.cargoLots}
          onCargoChange={(cargoLots) => updateForm({ cargoLots })}
          cargoMax={cargoMax}
        />
      )}
      {step === 'Review' && (
        <MechReviewStep form={form} isEdit={isEdit} submitError={submitError} />
      )}
    </WizShell>
  )
}
