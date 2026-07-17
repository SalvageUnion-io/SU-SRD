import { useEffect, useMemo, useRef, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { isLegalCreationAbility } from 'salvageunion-reference/rules'
import { toast } from 'component-lib'
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
import { clampPilotCreationDraft, pilotCreationStepGate } from '../../lib/rules/creation'
import type { PilotWizardStepId, StepGateResult } from '../../lib/rules/creation'
import {
  PILOT_BASE_AP,
  PILOT_BASE_HP,
  PILOT_BASE_INVENTORY_SLOTS,
} from '../../lib/rules/derivedStats'
import { enrichPilotSnapshot } from '../../lib/rules/pilotSnapshot'
import { evaluatePilotWarnings } from '../../lib/rules/softWarnings'
import { pilotInventoryCapacity, pilotInventoryUsed } from '../sheet/pilotInventory'
import { Banner } from 'component-lib'
import { OffRulesEscape } from '../wizard/OffRulesEscape'
import { RuleBrief } from '../wizard/RuleBrief'
import type { StepRule } from '../wizard/RuleBrief'
import { WizShell, WizTracker } from 'component-lib'
import { BackgroundStep } from './BackgroundStep'
import { CallsignStep } from './CallsignStep'
import { ClassAbilityStep } from './ClassAbilityStep'
import { EquipmentStep } from './EquipmentStep'
import { FlavorStep } from './FlavorStep'
import { ReviewStep } from './ReviewStep'
import { StatsStep } from './StatsStep'
import type { RollTableDeps } from './rollTableHelpers'
import {
  clearWizardDraft,
  readWizardDraft,
  useWizardDraftSync,
  wizardDraftKey,
} from '../../lib/wizard/wizardDraft'

/**
 * Book-order steps (Pilot Bay pp.18–19 + Review — plan §4.1). Edit mode
 * (§5.2) hides the display-only Stats briefing and keeps the rest.
 */
const CREATE_STEPS: readonly PilotWizardStepId[] = [
  'stats',
  'classAbility',
  'equipment',
  'callsign',
  'background',
  'motto',
  'keepsake',
  'appearance',
  'review',
]
const EDIT_STEPS: readonly PilotWizardStepId[] = CREATE_STEPS.filter((s) => s !== 'stats')

/** Stepper-rail labels (mockup Screen 01 `.rlabel`). */
const STEP_LABELS: Record<PilotWizardStepId, string> = {
  stats: 'Your Stats',
  classAbility: 'Class & Ability',
  equipment: 'Equipment',
  callsign: 'Callsign',
  background: 'Background',
  motto: 'Motto',
  keepsake: 'Keepsake',
  appearance: 'Appearance',
  review: 'Review',
}

/** Step headings — the book's own step names (pp.18–19). */
const STEP_TITLES: Record<PilotWizardStepId, string> = {
  stats: 'Fill out your Stats',
  classAbility: 'Choose your Pilot and your first Ability',
  equipment: 'Choose your Equipment',
  callsign: 'Choose your Callsign',
  background: 'Choose your Background',
  motto: 'Choose your Motto',
  keepsake: 'Choose your Keepsake',
  appearance: 'Choose your Appearance',
  review: 'Review',
}

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
  /** Leaves the guided flow for the blank Free-Edit path (P3.3). Create only. */
  onOffRules?: () => void
  /**
   * Id of an existing pilot being edited. When provided, handleSubmit takes
   * the update branch (never duplicates), the hard creation gates relax to
   * presence checks, budgets lift, and every option filter lifts (all
   * levels, all TLs, Advanced/Hybrid classes — plan §5.2).
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

/** Edit-mode gates: today's presence checks only (plan §5.2 — soft regime). */
function pilotEditStepGate(step: PilotWizardStepId, form: PilotWizardFormState): StepGateResult {
  const hasClass = form.classId !== ''
  const hasIdentity = form.name.trim() !== '' && form.callsign.trim() !== ''
  switch (step) {
    case 'classAbility':
      return hasClass ? { ok: true } : { ok: false, reason: 'Choose your class to continue' }
    case 'callsign':
      return hasIdentity
        ? { ok: true }
        : { ok: false, reason: 'Enter a Name and Callsign to continue' }
    case 'review':
      if (!hasClass) return { ok: false, reason: 'Choose your class to continue' }
      if (!hasIdentity) return { ok: false, reason: 'Enter a Name and Callsign to continue' }
      return { ok: true }
    default:
      return { ok: true }
  }
}

/**
 * Multi-step pilot wizard on the shared WizShell skeleton, restructured to
 * the Pilot Bay's 8 book steps + Review (wizard-refresh Phase 3, plan §4.1,
 * mockup Screen 01) with HARD creation enforcement (§5):
 *
 *   - illegal options are FILTERED OUT (core classes only, legal Level-1
 *     abilities only, Tech 1 equipment only) — never rendered;
 *   - exactly 1 ability (radio) and exactly 2 equipment picks (count-stepper,
 *     duplicates allowed) — Next is gated by `pilotCreationStepGate` and the
 *     unmet requirement renders in the footerNote;
 *   - cross-step invalidation (class change clears a now-illegal ability) and
 *     draft-restore clamping are deterministic and always announced by toast;
 *   - Banner is REMOVED from the create flow — nothing can be in
 *     violation. Edit mode keeps the soft regime (§5.2): presence gates,
 *     lifted filters, advisory warnings on Review.
 */
export function PilotWizard({
  onComplete,
  onCancel,
  onOffRules,
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
  const steps = isEdit ? EDIT_STEPS : CREATE_STEPS

  const [step, setStep] = useState<PilotWizardStepId>(steps[0] ?? 'classAbility')
  // Draft-aware init: a stored session draft (refresh, back-nav, PWA reload)
  // wins over the pristine initial state; cleared on submit/cancelled exit.
  // Create-mode drafts are passed through the deterministic clamp (§5.3) —
  // violations from a pre-enforcement draft resolve oldest-first to the 1/2
  // budgets and the removals are announced once, by toast.
  const draftKey = wizardDraftKey('pilot', pilotId)
  const clampRemovedRef = useRef<string[] | null>(null)
  const [form, setForm] = useState<PilotWizardFormState>(() => {
    const draft = readWizardDraft<PilotWizardFormState>(draftKey)
    if (draft && !isEdit) {
      const { form: clamped, removed } = clampPilotCreationDraft(draft)
      if (removed.length > 0) clampRemovedRef.current = removed
      return clamped
    }
    return draft ?? initialState ?? EMPTY_PILOT_FORM_STATE
  })
  useEffect(() => {
    const removed = clampRemovedRef.current
    if (removed && removed.length > 0) {
      clampRemovedRef.current = null
      toast.info(`Draft trimmed to creation limits — removed ${removed.join(', ')}.`)
    }
  }, [])
  const formDirty = useWizardDraftSync(draftKey, form, initialState ?? EMPTY_PILOT_FORM_STATE)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentIndex = steps.indexOf(step)

  // Pre-save soft warnings (plan §5.2): EDIT-mode Review only — the create
  // flow is hard-enforced, so nothing can be in violation and the banner is
  // gone from it entirely.
  const softWarnings = useMemo(() => {
    if (!isEdit || step !== 'review' || _sur) return []
    const before = existingPilot ? enrichPilotSnapshot(existingPilot) : { abilities: [] }
    const after = enrichPilotSnapshot({
      abilities: form.abilities,
      classRef: form.classId,
    })
    return evaluatePilotWarnings({ before, after }, { entityType: 'pilot' })
  }, [isEdit, step, _sur, existingPilot, form.abilities, form.classId])

  function updateForm(patch: Partial<PilotWizardFormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  /**
   * Class pick (radio). Creation clears a now-illegal ability with a toast
   * (§5.3 cross-step invalidation — never a silent mutation); a still-legal
   * pick survives (e.g. Salvager → Engineer keeping a shared core tree).
   * Edit keeps abilities — a specialising pilot retains learned core trees.
   */
  function handleSelectClass(classId: string) {
    if (isEdit) {
      updateForm({ classId })
      return
    }
    if (classId === form.classId) return
    const cls = sur.Classes.find((c) => (c as { id: string }).id === classId) as
      | { coreTrees?: string[] }
      | undefined
    const coreTrees = cls?.coreTrees
    const kept = form.abilities.filter((id) => {
      const ability = sur.Abilities.findAll((a) => (a as { id: string }).id === id)[0] as
        | { level: number | string; tree: string }
        | undefined
      return ability !== undefined && isLegalCreationAbility(ability, coreTrees)
    })
    const dropped = form.abilities.filter((id) => !kept.includes(id))
    if (dropped.length > 0) {
      const names = dropped.map(
        (id) =>
          (
            sur.Abilities.findAll((a) => (a as { id: string }).id === id)[0] as
              | { name: string }
              | undefined
          )?.name ?? id
      )
      toast.info(`Cleared ${names.join(', ')} — not a Level-1 ability of the new class.`)
    }
    updateForm({ classId, abilities: kept })
  }

  /** Ability pick: creation is a RADIO (the pick replaces); edit toggles. */
  function handleSelectAbility(abilityId: string) {
    if (!isEdit) {
      updateForm({ abilities: form.abilities.includes(abilityId) ? [] : [abilityId] })
      return
    }
    updateForm({
      abilities: form.abilities.includes(abilityId)
        ? form.abilities.filter((x) => x !== abilityId)
        : [...form.abilities, abilityId],
    })
  }

  /**
   * Create-mode equipment count-stepper write: duplicates allowed, the total
   * clamped at the 2-pick budget; decrements drop the OLDEST copies first
   * (the same determinism as the draft clamp).
   */
  function handleEquipmentCount(equipmentId: string, next: number) {
    setForm((prev) => {
      const current = prev.equipment.filter((e) => e === equipmentId).length
      const target = Math.max(0, next)
      if (target === current) return prev
      if (target > current) {
        const room = STARTING_EQUIPMENT_BUDGET - prev.equipment.length
        const add = Math.min(target - current, Math.max(0, room))
        if (add <= 0) return prev
        return {
          ...prev,
          equipment: [...prev.equipment, ...new Array<string>(add).fill(equipmentId)],
        }
      }
      let toRemove = current - target
      const equipment: string[] = []
      for (const e of prev.equipment) {
        if (e === equipmentId && toRemove > 0) {
          toRemove--
          continue
        }
        equipment.push(e)
      }
      return { ...prev, equipment }
    })
  }

  /** Edit-mode equipment toggle (uncapped — plan §5.2). */
  function toggleEquipment(equipmentId: string) {
    updateForm({
      equipment: form.equipment.includes(equipmentId)
        ? form.equipment.filter((x) => x !== equipmentId)
        : [...form.equipment, equipmentId],
    })
  }

  // Next-gating (§5.3): guided create runs the hard step gates; edit runs
  // presence checks. The gate's reason renders in the footerNote so a locked
  // Next always explains itself.
  const gate = isEdit ? pilotEditStepGate(step, form) : pilotCreationStepGate(step, form)

  function goNext() {
    if (step === 'review') {
      void handleSubmit()
      return
    }
    const next = steps[currentIndex + 1]
    if (next) setStep(next)
  }

  function goBack() {
    const prev = steps[currentIndex - 1]
    if (currentIndex > 0 && prev) {
      setStep(prev)
    }
  }

  async function handleSubmit() {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const store = useEntityStore.getState()

      // Upsert branch: update when editing — NEVER a second create.
      if (pilotId) {
        await store.update('pilot', pilotId, pilotFormToUpdatePatch(form))
        toast.success(`Saved ${form.name.trim() || 'pilot'}.`)
        clearWizardDraft(draftKey)
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
      clearWizardDraft(draftKey)
      onComplete(created.id)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save pilot. Please retry.')
      setIsSubmitting(false)
    }
  }

  // Per-step RuleBrief: the Core Book's own creation copy, pp.18–19 (create);
  // edit variants describe the lifted soft regime.
  const stepRule: StepRule = (() => {
    switch (step) {
      case 'stats':
        return {
          rule: 'Make a copy of the Character Sheet; your Pilot starts with 10 Hit Points, 5 Ability Points, and 6 Inventory Slots.',
          cite: 'Core Book · p.18 · Pilot Stats p.20',
        }
      case 'classAbility':
        return isEdit
          ? {
              rule: 'Choose your pilot class and abilities — any class, any tree, any level. Specialisation prerequisites and rule caps warn on Review, never block.',
              cite: 'Core Book · pp.18–19',
            }
          : {
              rule: 'There are six core Pilot classes; Engineer, Hacker, Hauler, Salvager, Scout, and Soldier. Each is differentiated by the different Ability trees they can pick from. Your Pilot starts with 1 Ability of your choice. The Salvager is an exception: as a ‘jack of all trades’ Class, they can pick from any of the Core Ability trees — however, they can never advance beyond them.',
              cite: 'Core Book · p.18 · Pilot Classes pp.26–77',
            }
      case 'equipment':
        return isEdit
          ? {
              rule: 'Choose Pilot Equipment — any tech level, uncapped. Inventory-slot overages warn on the sheet, never block.',
              cite: 'Core Book · pp.18–19',
            }
          : {
              rule: 'You may choose two pieces of Tech 1 Pilot Equipment from the list. Note these in your inventory. Most items fill 1 Inventory Slot; Heavy and Portable gear fills 2.',
              cite: 'Core Book · p.19 · Pilot Equipment pp.78–87',
            }
      case 'callsign':
        return {
          rule: 'Your Pilot’s Callsign is the name everyone on the Union Crawler refers to them as. It is typically a nickname, but can be their actual name. Pick or roll on the Callsign Table, or have everyone else at the table choose one for your Pilot based on their impression of them. Callsigns may also change in play in this manner.',
          cite: 'Core Book · p.19 · Callsign Table p.88',
        }
      case 'background':
        return {
          rule: 'Your Pilot’s Background is where they came from before they joined the Union Crawler. They may have been a wastelander, a member of the corpos, a wanderer, or even a born salvager. If a Pilot takes an action that aligns with their Background they may re-roll the dice on the action, accepting the second result. This Ability can be used once; a Pilot regains its use following Downtime.',
          cite: 'Core Book · p.19 · Background Table p.89',
        }
      case 'motto':
        return {
          rule: 'Your Pilot’s Motto is a phrase they happen to be fond of using. They may say this phrase, as a Free Action or Reaction, at a time during the game that feels appropriate, and another Pilot may re-roll the dice, accepting the second result. This Ability can be used once; a Pilot regains its use following Downtime.',
          cite: 'Core Book · p.19 · Motto Table p.90',
        }
      case 'keepsake':
        return {
          rule: 'Your Pilot’s Keepsake is an item that is personal and important to them. It could be an old photograph, a childhood bobblehead toy, or a music mixtape from an old sweetheart. If a Pilot takes an action that aligns with why their Keepsake is important to them, they may re-roll the dice on the action, accepting the second result. This Ability can be used once; a Pilot regains its use following Downtime.',
          cite: 'Core Book · p.18 · Keepsake Table p.90',
        }
      case 'appearance':
        return {
          rule: 'Briefly describe the appearance of your Pilot, and consider their gender and pronouns. Are they alluring, fancy, glamorous, tall, stocky, sloppy, or intimidating? Do they have any iconic features such as scars, wildly spiked hair, a mischievous grin, or crooked teeth? What type of clothing do they wear? Do they go by she, he, they, or something else?',
          cite: 'Core Book · p.18 · Appearance Table p.91',
        }
      case 'review':
        return {
          rule: isEdit
            ? 'Check the changes, then save.'
            : `Recap: 1 class · 1 ability · 2 Tech 1 items · ${PILOT_BASE_HP} HP · ${PILOT_BASE_AP} AP · ${PILOT_BASE_INVENTORY_SLOTS} slots. Check the build, then create.`,
          cite: isEdit ? undefined : 'Core Book · pp.18–19',
        }
    }
  })()

  // Tracker tabs in the action pill: live pick counts, and on the equipment
  // step the slot preview via the sheets' pilotInventory math (Heavy/Portable
  // = 2 slots — the tracker is the live truth, never the pick count).
  const trackers = (() => {
    switch (step) {
      case 'classAbility':
        return (
          <WizTracker
            label="Ability"
            value={
              <span data-testid="ability-count">
                {form.abilities.length}
                {isEdit ? '' : ` / ${STARTING_ABILITY_BUDGET}`}
              </span>
            }
          />
        )
      case 'equipment': {
        const picks = (
          <WizTracker
            label="Picks"
            value={
              <span data-testid="equipment-count">
                {form.equipment.length}
                {isEdit ? '' : ` / ${STARTING_EQUIPMENT_BUDGET}`}
              </span>
            }
          />
        )
        if (isEdit) return picks
        const slotsUsed = pilotInventoryUsed({ equipment: form.equipment, genericInventory: [] })
        return (
          <>
            {picks}
            <WizTracker
              label="Slots"
              value={
                <span data-testid="slot-preview">
                  {slotsUsed} / {pilotInventoryCapacity()}
                </span>
              }
            />
          </>
        )
      }
      default:
        return undefined
    }
  })()

  return (
    <WizShell
      kind="pilot"
      eyebrow={isEdit ? 'Edit Pilot' : 'Pilot Bay'}
      steps={steps.map((s) => STEP_LABELS[s])}
      active={currentIndex}
      onStepClick={(i) => {
        const s = steps[i]
        if (s) setStep(s)
      }}
      title={STEP_TITLES[step]}
      tintedStepCard
      notice={isEdit && step === 'review' ? <Banner warnings={softWarnings} /> : undefined}
      trackers={trackers}
      footerNote={gate.ok ? undefined : gate.reason}
      escapeAction={
        !isEdit && !gate.ok && onOffRules ? <OffRulesEscape onEscape={onOffRules} /> : undefined
      }
      onBack={currentIndex > 0 ? goBack : undefined}
      onCancel={() => {
        clearWizardDraft(draftKey)
        onCancel()
      }}
      confirmCancel={formDirty}
      onNext={goNext}
      nextDisabled={!gate.ok}
      busy={isSubmitting}
      submitLabel={isEdit ? 'Save Pilot' : 'Create Pilot ✦'}
    >
      <RuleBrief rule={stepRule.rule} cite={stepRule.cite} className="mb-5" />
      {step === 'stats' && <StatsStep />}
      {step === 'classAbility' && (
        <ClassAbilityStep
          isEdit={isEdit}
          classId={form.classId}
          selectedAbilities={form.abilities}
          onSelectClass={handleSelectClass}
          onSelectAbility={handleSelectAbility}
          _sur={_sur ? { Classes: sur.Classes, Abilities: sur.Abilities } : undefined}
        />
      )}
      {step === 'equipment' && (
        <EquipmentStep
          selectedEquipment={form.equipment}
          onToggle={toggleEquipment}
          onCountChange={handleEquipmentCount}
          budget={isEdit ? undefined : STARTING_EQUIPMENT_BUDGET}
          _sur={{ Equipment: sur.Equipment }}
        />
      )}
      {step === 'callsign' && (
        <CallsignStep
          name={form.name}
          callsign={form.callsign}
          onChange={(field, value) => updateForm({ [field]: value })}
          _rollDeps={_rollDeps}
        />
      )}
      {step === 'background' && (
        <BackgroundStep
          background={form.background}
          onChange={(v) => updateForm({ background: v })}
          description={form.description}
          onDescriptionChange={(v) => updateForm({ description: v })}
          _rollDeps={_rollDeps}
        />
      )}
      {step === 'motto' && (
        <FlavorStep
          field="motto"
          label="Motto"
          value={form.motto}
          onChange={(v) => updateForm({ motto: v })}
          placeholder="A phrase your pilot lives by"
          _rollDeps={_rollDeps}
        />
      )}
      {step === 'keepsake' && (
        <FlavorStep
          field="keepsake"
          label="Keepsake"
          value={form.keepsake}
          onChange={(v) => updateForm({ keepsake: v })}
          placeholder="Something precious from your past"
          _rollDeps={_rollDeps}
        />
      )}
      {step === 'appearance' && (
        <FlavorStep
          field="appearance"
          label="Appearance"
          value={form.appearance}
          onChange={(v) => updateForm({ appearance: v })}
          placeholder="How does your pilot look?"
          multiline
          _rollDeps={_rollDeps}
        />
      )}
      {step === 'review' && (
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
