import type { StepRule } from 'component-lib'
import { RuleBrief, toast, WizShell, WizTracker } from 'component-lib'
import { useEffect, useRef, useState } from 'react'
import type { SURefAbility, SURefClass, SURefEquipment } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  isLegalCreationAbility,
  PILOT_BASE_AP,
  PILOT_BASE_HP,
  PILOT_BASE_INVENTORY_SLOTS,
} from 'salvageunion-reference/rules'
import { STARTING_ABILITY_BUDGET, STARTING_EQUIPMENT_BUDGET } from '../../lib/constants'
import type { PilotWizardStepId } from '../../lib/rules/creation'
import { clampPilotCreationDraft, pilotCreationStepGate } from '../../lib/rules/creation'
import { PilotSchema } from '../../lib/schemas/pilot'
import type { PilotWizardFormState } from '../../lib/wizard/pilotFormState'
import { EMPTY_PILOT_FORM_STATE, pilotFormToCreateInput } from '../../lib/wizard/pilotFormState'
import { readWizardDraft, useWizardDraftSync, wizardDraftKey } from '../../lib/wizard/wizardDraft'
import { pilotInventoryCapacity, pilotInventoryUsed } from '../sheet/pilotInventory'
import { BackgroundStep } from '../wizard/BackgroundStep'
import { CallsignStep } from '../wizard/CallsignStep'
import { ClassAbilityStep } from '../wizard/ClassAbilityStep'
import { EquipmentStep } from '../wizard/EquipmentStep'
import { FlavorStep } from '../wizard/FlavorStep'
import type { RollTableDeps } from '../wizard/rollTableHelpers'
import { useWizardFlow } from '../wizard/useWizardFlow'
import { ReviewStep } from './ReviewStep'
import { StatsStep } from './StatsStep'

/** Book-order steps (Pilot Bay pp.18–19 + Review — plan §4.1). */
const STEPS: readonly PilotWizardStepId[] = [
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
    all: () => SURefClass[]
    find: (fn: (x: SURefClass) => boolean) => SURefClass | undefined
  }
  Abilities: { findAll: (fn: (x: SURefAbility) => boolean) => SURefAbility[] }
  Equipment: { findAll: (fn: (x: SURefEquipment) => boolean) => SURefEquipment[] }
}

type PilotWizardProps = {
  /** Called on successful create with the pilot's id. */
  onComplete: (pilotId: string) => void
  /** Called when the user cancels. */
  onCancel: () => void
  /** Leaves the guided flow for the blank Free-Edit path (P3.3). */
  onOffRules?: () => void
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
 *   - there is no warnings Banner — nothing can be in violation.
 */
export function PilotWizard({
  onComplete,
  onCancel,
  onOffRules,
  _rollDeps,
  _sur,
}: PilotWizardProps) {
  // Use injected SUR or the real module (for testing without module mocking)
  const sur: SURDeps = _sur ?? {
    Classes: SalvageUnionReference.Classes,
    Abilities: SalvageUnionReference.Abilities,
    Equipment: SalvageUnionReference.Equipment,
  }

  // Draft-aware init: a stored session draft (refresh, back-nav, PWA reload)
  // wins over the empty state; cleared on submit/cancelled exit. Drafts pass
  // through the deterministic clamp (§5.3) — violations from a
  // pre-enforcement draft resolve oldest-first to the 1/2 budgets and the
  // removals are announced once, by toast.
  const draftKey = wizardDraftKey('pilot')
  const clampRemovedRef = useRef<string[] | null>(null)
  const [form, setForm] = useState<PilotWizardFormState>(() => {
    const draft = readWizardDraft<PilotWizardFormState>(draftKey)
    if (!draft) return EMPTY_PILOT_FORM_STATE
    const { form: clamped, removed } = clampPilotCreationDraft(draft)
    if (removed.length > 0) clampRemovedRef.current = removed
    return clamped
  })
  useEffect(() => {
    const removed = clampRemovedRef.current
    if (removed && removed.length > 0) {
      clampRemovedRef.current = null
      toast.info(`Draft trimmed to creation limits — removed ${removed.join(', ')}.`)
    }
  }, [])
  const formDirty = useWizardDraftSync(draftKey, form, EMPTY_PILOT_FORM_STATE)

  // The step machine + the create submit, shared with the mech and crawler
  // wizards (`useWizardFlow`); the pilot's create input is a plain projection
  // of the form.
  const { step, gate, submitError, shell } = useWizardFlow({
    entityType: 'pilot',
    noun: 'pilot',
    steps: STEPS,
    stepLabels: STEP_LABELS,
    gateFor: (s) => pilotCreationStepGate(s, form),
    initialStep: 'stats',
    submitStep: 'review',
    form,
    draftKey,
    formDirty,
    schema: PilotSchema,
    toCreateInput: pilotFormToCreateInput,
    failureMessage: 'Failed to save pilot. Please retry.',
    onComplete,
    onCancel,
    onOffRules,
  })

  function updateForm(patch: Partial<PilotWizardFormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  /**
   * Class pick (radio). Clears a now-illegal ability with a toast (§5.3
   * cross-step invalidation — never a silent mutation); a still-legal pick
   * survives (e.g. Salvager → Engineer keeping a shared core tree).
   */
  function handleSelectClass(classId: string) {
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

  /** Ability pick is a RADIO: the pick replaces; re-picking it clears. */
  function handleSelectAbility(abilityId: string) {
    updateForm({ abilities: form.abilities.includes(abilityId) ? [] : [abilityId] })
  }

  /**
   * Equipment count-stepper write: duplicates allowed, the total
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

  // Per-step RuleBrief: the Core Book's own creation copy, pp.18–19.
  const stepRule: StepRule = (() => {
    switch (step) {
      case 'stats':
        return {
          rule: 'Make a copy of the Character Sheet; your Pilot starts with 10 Hit Points, 5 Ability Points, and 6 Inventory Slots.',
          cite: 'Core Book · p.18 · Pilot Stats p.20',
        }
      case 'classAbility':
        return {
          rule: 'There are six core Pilot classes; Engineer, Hacker, Hauler, Salvager, Scout, and Soldier. Each is differentiated by the different Ability trees they can pick from. Your Pilot starts with 1 Ability of your choice. The Salvager is an exception: as a ‘jack of all trades’ Class, they can pick from any of the Core Ability trees — however, they can never advance beyond them.',
          cite: 'Core Book · p.18 · Pilot Classes pp.26–77',
        }
      case 'equipment':
        return {
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
          rule: `Recap: 1 class · 1 ability · 2 Tech 1 items · ${PILOT_BASE_HP} HP · ${PILOT_BASE_AP} AP · ${PILOT_BASE_INVENTORY_SLOTS} slots. Check the build, then create.`,
          cite: 'Core Book · pp.18–19',
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
                {` / ${STARTING_ABILITY_BUDGET}`}
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
                {` / ${STARTING_EQUIPMENT_BUDGET}`}
              </span>
            }
          />
        )
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
      eyebrow="Pilot Bay"
      {...shell}
      title={STEP_TITLES[step]}
      trackers={trackers}
      footerNote={gate.ok ? undefined : gate.reason}
      submitLabel="Create Pilot ✦"
    >
      <RuleBrief rule={stepRule.rule} cite={stepRule.cite} className="mb-5" />
      {step === 'stats' && <StatsStep />}
      {step === 'classAbility' && (
        <ClassAbilityStep
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
          onCountChange={handleEquipmentCount}
          budget={STARTING_EQUIPMENT_BUDGET}
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
