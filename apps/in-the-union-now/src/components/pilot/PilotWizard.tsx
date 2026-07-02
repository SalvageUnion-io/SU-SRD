import { useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefClass } from 'salvageunion-reference'
import { toast } from 'suref-react'
import { usePilot } from '../../hooks/queries'
import { PilotSchema } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import { STARTING_ABILITY_BUDGET, STARTING_EQUIPMENT_BUDGET } from '../../lib/constants'
import {
  EMPTY_PILOT_FORM_STATE,
  pilotFormToCreateInput,
  pilotFormToUpdatePatch,
} from '../../lib/wizard/pilotFormState'
import type { PilotWizardFormState } from '../../lib/wizard/pilotFormState'
import { enrichPilotSnapshot } from '../../lib/rules/pilotSnapshot'
import { evaluatePilotWarnings } from '../../lib/rules/softWarnings'
import { SoftWarningBanner } from '../shared/SoftWarningBanner'
import { WizShell } from '../wizard/WizShell'
import { AbilitiesStep } from './AbilitiesStep'
import { BackgroundStep } from './BackgroundStep'
import { selectableClasses } from './classOptions'
import { ClassDetail, ClassOptionList } from './ClassStep'
import { EquipmentStep } from './EquipmentStep'
import { IdentityStep } from './IdentityStep'
import { ReviewStep } from './ReviewStep'
import type { RollTableDeps } from './rollTableHelpers'

const STEPS = ['Class', 'Abilities', 'Equipment', 'Identity', 'Background', 'Review'] as const
type Step = (typeof STEPS)[number]

/**
 * Injectable SalvageUnionReference surface for testing without module-level mocks.
 * Matches the subset of SUR used by child steps.
 */
type SURDeps = {
  Classes: {
    all: () => unknown[]
    find: (fn: (x: unknown) => boolean) => unknown
  }
  Abilities: { findAll: (fn: (x: unknown) => boolean) => unknown[] }
  Equipment: { findAll: (fn: (x: unknown) => boolean) => unknown[] }
}

type PilotWizardProps = {
  /** Called on successful create/save with the pilot's id. */
  onComplete: (pilotId: string) => void
  /** Called when the user cancels. */
  onCancel: () => void
  /**
   * Id of an existing pilot being edited. When provided, handleSubmit takes
   * the update branch (never duplicates), selection budgets lift, and
   * Advanced/Hybrid classes become selectable (plan 3.1/3.3).
   */
  pilotId?: string
  /**
   * Initial form state — pass `pilotToFormState(pilot)` in edit mode.
   * Defaults to the empty creation state.
   */
  initialState?: PilotWizardFormState
  /**
   * Injectable roll table deps for testing — omit in production.
   * Used to stub the SalvageUnionReference.RollTables accessor in tests.
   */
  _rollDeps?: RollTableDeps
  /**
   * Injectable SalvageUnionReference mock for testing class/ability/equipment data.
   * Omit in production — uses the real SalvageUnionReference module.
   */
  _sur?: SURDeps
}

/** Step heading copy (design §3.2). */
const STEP_TITLES: Record<Step, string> = {
  Class: 'Choose Your Class',
  Abilities: 'Choose Abilities',
  Equipment: 'Choose Equipment',
  Identity: 'Your Identity',
  Background: 'Your Background',
  Review: 'Review',
}

/**
 * Multi-step pilot wizard on the shared WizShell skeleton (plan 3.2).
 *
 * Edit seams are layout-agnostic (plan 3.1): the entity→form mapping happens
 * in lib/wizard/pilotFormState.ts, the upsert branch lives in handleSubmit,
 * and step components carry NO edit logic — they only receive declarative
 * props (budget, allLevels) that the wizard derives from edit mode.
 *
 * Soft warnings are evaluated PRE-save against the form state (plan 3.4) and
 * rendered as an advisory banner on the Review step — never blocking.
 */
export function PilotWizard({
  onComplete,
  onCancel,
  pilotId,
  initialState,
  _rollDeps,
  _sur,
}: PilotWizardProps) {
  // Use injected SUR or the real module (for testing without module mocking)
  const sur: SURDeps = _sur ?? {
    Classes: SalvageUnionReference.Classes as unknown as SURDeps['Classes'],
    Abilities: SalvageUnionReference.Abilities as unknown as SURDeps['Abilities'],
    Equipment: SalvageUnionReference.Equipment as unknown as SURDeps['Equipment'],
  }

  const isEdit = pilotId !== undefined
  const existingPilot = usePilot(pilotId)

  const [step, setStep] = useState<Step>('Class')
  const [form, setForm] = useState<PilotWizardFormState>(initialState ?? EMPTY_PILOT_FORM_STATE)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentIndex = STEPS.indexOf(step)

  // Pre-save soft warnings (plan 3.4): before = stored pilot (or empty in
  // create mode), after = the form. Pure evaluation, advisory only.
  const softWarnings = useMemo(() => {
    if (step !== 'Review' || _sur) return []
    const before = existingPilot ? enrichPilotSnapshot(existingPilot) : { abilities: [] }
    const after = enrichPilotSnapshot({
      abilities: form.abilities,
      classRef: form.classId,
    })
    return evaluatePilotWarnings({ before, after }, { entityType: 'pilot' })
  }, [step, _sur, existingPilot, form.abilities, form.classId])

  function updateForm(patch: Partial<PilotWizardFormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function canAdvance(): boolean {
    switch (step) {
      case 'Class':
        return form.classId !== ''
      case 'Abilities':
        return true // abilities are optional
      case 'Equipment':
        return true // equipment is optional
      case 'Identity':
        return form.callsign.trim() !== '' && form.name.trim() !== ''
      case 'Background':
        return true // background is optional
      case 'Review':
        return form.name.trim() !== '' && form.callsign.trim() !== '' && form.classId !== ''
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

  function toggleIn(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  async function handleSubmit() {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const store = useEntityStore.getState()

      // Upsert branch (plan 3.1): update when editing — NEVER a second create.
      if (pilotId) {
        await store.update('pilot', pilotId, pilotFormToUpdatePatch(form))
        toast.success(`Saved ${form.name.trim() || 'pilot'}.`)
        onComplete(pilotId)
        return
      }

      const now = new Date().toISOString()
      const rawInput = pilotFormToCreateInput(form)

      // Validate against PilotSchema before submitting (surface errors in-UI)
      const validation = PilotSchema.safeParse({
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

      const created = await store.create('pilot', rawInput)
      toast.success(`Saved ${form.name.trim() || 'pilot'}.`)
      onComplete(created.id)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save pilot. Please retry.')
      setIsSubmitting(false)
    }
  }

  // Class step master-detail data. Edit mode adds Advanced/Hybrid
  // specialisation classes — prerequisites are pre-save soft warnings.
  const classes = selectableClasses(sur.Classes, isEdit)
  const selectedClass = form.classId
    ? ([...classes.base, ...classes.specialisations].find((c) => c.id === form.classId) as
        | SURefClass
        | undefined)
    : undefined

  // Selection budgets: creation caps picks; edit lifts the cap (plan 3.3).
  const abilityBudget = isEdit ? undefined : STARTING_ABILITY_BUDGET
  const equipmentBudget = isEdit ? undefined : STARTING_EQUIPMENT_BUDGET

  const subtitle = (() => {
    switch (step) {
      case 'Class':
        return 'Choose your pilot class. This determines your ability trees.'
      case 'Abilities':
        return isEdit ? (
          <>
            {form.abilities.length} selected · TP available: {existingPilot?.trainingPoints ?? 0} ·
            rule caps warn, never block
          </>
        ) : (
          <>
            Up to {abilityBudget} from your class trees.{' '}
            <span data-testid="ability-count">
              {form.abilities.length} / {abilityBudget} selected
            </span>
            .
          </>
        )
      case 'Equipment':
        return isEdit ? (
          <>{form.equipment.length} selected · Tech Level 1 gear</>
        ) : (
          <>
            Up to {equipmentBudget} items at Tech Level 1.{' '}
            <span data-testid="equipment-count">
              {form.equipment.length} / {equipmentBudget} selected
            </span>
            .
          </>
        )
      case 'Identity':
        return 'Roll for random results or type your own.'
      case 'Background':
        return 'Optional — where your pilot came from.'
      case 'Review':
        return isEdit ? 'Check the changes, then save.' : 'Check the build, then create.'
    }
  })()

  return (
    <WizShell
      eyebrow={isEdit ? 'Edit Pilot' : 'New Pilot'}
      steps={STEPS}
      active={currentIndex}
      onStepClick={(i) => setStep(STEPS[i]!)}
      title={STEP_TITLES[step]}
      subtitle={subtitle}
      optionPane={
        step === 'Class' ? (
          <ClassOptionList
            base={classes.base}
            specialisations={classes.specialisations}
            selectedClassId={form.classId}
            onSelect={(classId) => {
              // Creation resets abilities on class change (different trees).
              // Edit keeps them — a specialising pilot retains learned core
              // abilities (rules: hybrid keeps core trees).
              updateForm(isEdit ? { classId } : { classId, abilities: [] })
            }}
          />
        ) : undefined
      }
      notice={step === 'Review' ? <SoftWarningBanner warnings={softWarnings} /> : undefined}
      onBack={currentIndex > 0 ? goBack : undefined}
      onCancel={onCancel}
      onNext={goNext}
      nextDisabled={!canAdvance()}
      busy={isSubmitting}
      submitLabel={isEdit ? 'Save Pilot' : 'Create Pilot ✦'}
    >
      {step === 'Class' && <ClassDetail selectedClass={selectedClass} />}
      {step === 'Abilities' && (
        <AbilitiesStep
          classId={form.classId}
          selectedAbilities={form.abilities}
          onToggle={(id) => updateForm({ abilities: toggleIn(form.abilities, id) })}
          budget={abilityBudget}
          allLevels={isEdit}
          _sur={{ Classes: sur.Classes, Abilities: sur.Abilities }}
        />
      )}
      {step === 'Equipment' && (
        <EquipmentStep
          selectedEquipment={form.equipment}
          onToggle={(id) => updateForm({ equipment: toggleIn(form.equipment, id) })}
          budget={equipmentBudget}
          _sur={{ Equipment: sur.Equipment }}
        />
      )}
      {step === 'Identity' && (
        <IdentityStep
          name={form.name}
          callsign={form.callsign}
          motto={form.motto}
          keepsake={form.keepsake}
          appearance={form.appearance}
          onChange={(field, value) => updateForm({ [field]: value })}
          _rollDeps={_rollDeps}
        />
      )}
      {step === 'Background' && (
        <BackgroundStep
          background={form.background}
          onChange={(v) => updateForm({ background: v })}
          _rollDeps={_rollDeps}
        />
      )}
      {step === 'Review' && (
        <ReviewStep
          form={form}
          trainingPoints={isEdit ? (existingPilot?.trainingPoints ?? 0) : undefined}
          submitError={submitError}
          _sur={
            _sur
              ? {
                  Classes: sur.Classes,
                  Abilities: sur.Abilities,
                  Equipment: sur.Equipment,
                }
              : undefined
          }
        />
      )}
    </WizShell>
  )
}
