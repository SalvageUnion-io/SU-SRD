import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { PilotSchema } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import { Button } from '../ui/button'
import { AbilitiesStep } from './AbilitiesStep'
import { BackgroundStep } from './BackgroundStep'
import { ClassStep } from './ClassStep'
import { EquipmentStep } from './EquipmentStep'
import { IdentityStep } from './IdentityStep'
import type { RollTableDeps } from './rollTableHelpers'
// TODO(cycle-3): SoftWarningBanner is wired on the Review step but is a no-op
// during the create wizard (no entityId until after create resolves).
// Wire into edit flow once /pilots/$id gains inline editing (deferred to later wave).
import { SoftWarningBanner } from '../shared/SoftWarningBanner'
import { useSoftWarnings } from '../shared/useSoftWarnings'

/** Shape of form state carried through the wizard. */
type WizardFormState = {
  name: string
  classId: string
  abilities: string[]
  equipment: string[]
  callsign: string
  motto: string
  keepsake: string
  appearance: string
  background: string
}

const INITIAL_STATE: WizardFormState = {
  name: '',
  classId: '',
  abilities: [],
  equipment: [],
  callsign: '',
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
}

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
  /** Called on successful creation with the new pilot's id. */
  onComplete: (pilotId: string) => void
  /** Called when the user cancels. */
  onCancel: () => void
  /**
   * Id of an existing pilot being edited. When provided, SoftWarningBanner is
   * active on the Review step. Omit in create mode (no-op until id exists).
   */
  pilotId?: string
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

/**
 * Multi-step pilot creation wizard.
 *
 * Design choice: multi-step (not tabbed) because each step depends on the
 * previous one (abilities need a class, equipment follows, etc.) and a linear
 * flow makes that dependency clear.
 *
 * Form state: plain React state — react-hook-form is not in the dep set.
 */
export function PilotWizard({ onComplete, onCancel, pilotId, _rollDeps, _sur }: PilotWizardProps) {
  // Use injected SUR or the real module (for testing without module mocking)
  const sur: SURDeps = _sur ?? {
    Classes: SalvageUnionReference.Classes as unknown as SURDeps['Classes'],
    Abilities: SalvageUnionReference.Abilities as unknown as SURDeps['Abilities'],
    Equipment: SalvageUnionReference.Equipment as unknown as SURDeps['Equipment'],
  }

  const [step, setStep] = useState<Step>('Class')
  const [form, setForm] = useState<WizardFormState>(INITIAL_STATE)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // SoftWarningBanner — active only in edit mode (pilotId provided).
  // In create mode (no pilotId) the hook returns empty warnings (entity not found).
  const {
    warnings: softWarnings,
    saveAnyway: saveSoftAnyway,
    fixIt: fixSoftWarnings,
  } = useSoftWarnings({
    entityType: 'pilot',
    entityId: pilotId ?? '',
  })

  const currentIndex = STEPS.indexOf(step)

  function updateForm(patch: Partial<WizardFormState>) {
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
        return true
    }
  }

  function goNext() {
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1]!)
    }
  }

  function goBack() {
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1]!)
    }
  }

  function toggleAbility(abilityId: string) {
    setForm((prev) => {
      const already = prev.abilities.includes(abilityId)
      return {
        ...prev,
        abilities: already
          ? prev.abilities.filter((a) => a !== abilityId)
          : [...prev.abilities, abilityId],
      }
    })
  }

  function toggleEquipment(equipmentId: string) {
    setForm((prev) => {
      const already = prev.equipment.includes(equipmentId)
      return {
        ...prev,
        equipment: already
          ? prev.equipment.filter((e) => e !== equipmentId)
          : [...prev.equipment, equipmentId],
      }
    })
  }

  async function handleSubmit() {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const now = new Date().toISOString()
      const rawInput = {
        schemaVersion: 1 as const,
        name: form.name.trim(),
        callsign: form.callsign.trim(),
        classRef: form.classId,
        abilities: form.abilities,
        equipment: form.equipment,
        rollResults: [],
        motto: form.motto.trim(),
        keepsake: form.keepsake.trim(),
        appearance: form.appearance.trim(),
        background: form.background.trim(),
        conditions: [],
      }

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

      const created = await useEntityStore.getState().create('pilot', rawInput)
      onComplete(created.id)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save pilot. Please retry.')
      setIsSubmitting(false)
    }
  }

  const selectedClass = form.classId
    ? sur.Classes.find((c) => (c as { id: string }).id === form.classId)
    : null

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
        {/* Progress indicator — vertical rail on desktop, horizontal on mobile */}
        <nav aria-label="Wizard steps" className="mb-6 lg:mb-0">
          <ol className="flex items-center gap-2 text-xs lg:sticky lg:top-4 lg:flex-col lg:items-stretch lg:gap-1">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={[
                  'rounded px-2 py-1 lg:px-3 lg:py-2',
                  s === step
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : i < currentIndex
                      ? 'opacity-60'
                      : 'opacity-30',
                ].join(' ')}
              >
                {s}
              </li>
            ))}
          </ol>
        </nav>

        {/* Content column */}
        <div className="min-w-0 space-y-6">
          {/* Step heading */}
          <h2 className="text-xl font-bold">
            {step === 'Class' && 'Choose Your Class'}
            {step === 'Abilities' && 'Choose Starting Abilities'}
            {step === 'Equipment' && 'Choose Starting Equipment'}
            {step === 'Identity' && 'Your Identity'}
            {step === 'Background' && 'Your Background'}
            {step === 'Review' && 'Review & Create'}
          </h2>

          {/* Name field — shown on Identity step */}
          {step === 'Identity' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium" htmlFor="pilot-name">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                id="pilot-name"
                type="text"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="Your pilot's real name"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {/* Step content */}
          {step === 'Class' && (
            <ClassStep
              selectedClassId={form.classId}
              onSelect={(classId) => {
                // Resetting abilities when class changes since trees differ
                updateForm({ classId, abilities: [] })
              }}
              _sur={sur.Classes}
            />
          )}
          {step === 'Abilities' && (
            <AbilitiesStep
              classId={form.classId}
              selectedAbilities={form.abilities}
              onToggle={toggleAbility}
              _sur={{ Classes: sur.Classes, Abilities: sur.Abilities }}
            />
          )}
          {step === 'Equipment' && (
            <EquipmentStep
              selectedEquipment={form.equipment}
              onToggle={toggleEquipment}
              _sur={{ Equipment: sur.Equipment }}
            />
          )}
          {step === 'Identity' && (
            <IdentityStep
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

          {/* Review step */}
          {step === 'Review' && (
            <div className="space-y-4 rounded-lg border border-border p-4 text-sm">
              <div>
                <span className="font-semibold">Name: </span>
                {form.name || <span className="text-destructive">required</span>}
              </div>
              <div>
                <span className="font-semibold">Callsign: </span>
                {form.callsign || <span className="text-destructive">required</span>}
              </div>
              <div>
                <span className="font-semibold">Class: </span>
                {selectedClass ? (
                  (selectedClass as { name: string }).name
                ) : (
                  <span className="text-destructive">required</span>
                )}
              </div>
              <div>
                <span className="font-semibold">Abilities: </span>
                {form.abilities.length > 0
                  ? form.abilities
                      .map((id) => {
                        const found = sur.Abilities.findAll(
                          (a) => (a as { id: string }).id === id
                        )[0]
                        return found ? (found as { name: string }).name : id
                      })
                      .join(', ')
                  : 'none'}
              </div>
              <div>
                <span className="font-semibold">Equipment: </span>
                {form.equipment.length > 0
                  ? form.equipment
                      .map((id) => {
                        const found = sur.Equipment.findAll(
                          (e) => (e as { id: string }).id === id
                        )[0]
                        return found ? (found as { name: string }).name : id
                      })
                      .join(', ')
                  : 'none'}
              </div>
              <div>
                <span className="font-semibold">Motto: </span>
                {form.motto || '—'}
              </div>
              <div>
                <span className="font-semibold">Keepsake: </span>
                {form.keepsake || '—'}
              </div>
              <div>
                <span className="font-semibold">Appearance: </span>
                {form.appearance || '—'}
              </div>
              <div>
                <span className="font-semibold">Background: </span>
                {form.background || '—'}
              </div>

              {submitError && (
                <p role="alert" className="text-sm text-destructive">
                  {submitError}
                </p>
              )}
            </div>
          )}

          {/* Soft warnings (edit mode only — no-op in create flow) */}
          <SoftWarningBanner
            warnings={softWarnings}
            onSaveAnyway={() => void saveSoftAnyway()}
            onFixIt={fixSoftWarnings}
          />

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <div className="flex gap-2">
              {currentIndex > 0 && (
                <Button type="button" variant="ghost" onClick={goBack} disabled={isSubmitting}>
                  Back
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
                Cancel
              </Button>
            </div>

            {step !== 'Review' ? (
              <Button type="button" onClick={goNext} disabled={!canAdvance()}>
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={
                  isSubmitting || !form.name.trim() || !form.callsign.trim() || !form.classId
                }
              >
                {isSubmitting ? 'Creating…' : 'Create Pilot'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
