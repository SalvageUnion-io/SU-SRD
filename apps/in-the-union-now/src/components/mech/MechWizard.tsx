import { useEffect, useMemo, useRef, useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { MECH_CREATION_SCRAP_CAP } from 'salvageunion-reference/rules'
import { toast } from 'suref-react'
import { computeMechCapacity } from '../../lib/rules/capacity'
import {
  clampMechCreationDraft,
  mechCreationBudgetFor,
  mechCreationStepGate,
} from '../../lib/rules/creation'
import type { MechWizardStepId, StepGateResult } from '../../lib/rules/creation'
import { mechMaxEP } from '../../lib/rules/derivedStats'
import {
  matchesRef,
  resolveChassisRef,
  resolveModuleRef,
  resolveSystemRef,
} from '../../lib/rules/resolveRefs'
import { evaluateMechWarnings } from '../../lib/rules/softWarnings'
import type { SoftWarning } from '../../lib/rules/types'
import { MechSchema } from '../../lib/schemas/mech'
import {
  EMPTY_MECH_FORM_STATE,
  mechFormToCreateInput,
  mechFormToUpdatePatch,
} from '../../lib/wizard/mechFormState'
import type { MechWizardFormState } from '../../lib/wizard/mechFormState'
import { useMech } from '../../hooks/queries'
import { useEntityStore } from '../../stores/entityStore'
import { Banner } from 'suref-react'
import { OffRulesEscape } from '../wizard/OffRulesEscape'
import { RuleBrief } from '../wizard/RuleBrief'
import type { StepRule } from '../wizard/RuleBrief'
import { WizShell, WizTracker } from 'suref-react'
import { CraftItemsStep } from './CraftItemsStep'
import { GainScrapStep } from './GainScrapStep'
import { InstallStep } from './InstallStep'
import { MechChassisStep } from './MechChassisStep'
import type { ChassisPattern } from './MechChassisStep'
import { MechFlavorStep } from './MechFlavorStep'
import { MechReviewStep } from './MechReviewStep'
import { MechStatsStep } from './MechStatsStep'
import {
  clearWizardDraft,
  readWizardDraft,
  useWizardDraftSync,
  wizardDraftKey,
} from '../../lib/wizard/wizardDraft'

/**
 * Book-order steps (Mech Workshop pp.94–95 + Review — plan §4.2). Edit mode
 * (§5.2) hides the Gain Scrap briefing and the display-only Statistics step
 * and keeps the rest (2, 4, 5, 6, 7, 8, Review).
 */
const CREATE_STEPS: readonly MechWizardStepId[] = [
  'scrap',
  'chassis',
  'stats',
  'systems',
  'modules',
  'quirk',
  'appearance',
  'pattern',
  'review',
]
const EDIT_STEPS: readonly MechWizardStepId[] = CREATE_STEPS.filter(
  (s) => s !== 'scrap' && s !== 'stats'
)

/** Stepper-rail labels (mockup Screen 02 `.rlabel`). */
const STEP_LABELS: Record<MechWizardStepId, string> = {
  scrap: 'Gain Scrap',
  chassis: 'Craft your Chassis',
  stats: 'Mech Statistics',
  systems: 'Craft your Systems',
  modules: 'Craft your Modules',
  quirk: 'Quirk',
  appearance: 'Appearance',
  pattern: 'Pattern Name',
  review: 'Review',
}

/** Step headings — the book's own step names (pp.94–95). */
const STEP_TITLES: Record<MechWizardStepId, string> = {
  scrap: 'Gain Scrap',
  chassis: 'Craft your Mech Chassis',
  stats: 'Note down your Mech’s Statistics',
  systems: 'Craft your Systems',
  modules: 'Craft your Modules',
  quirk: 'Choose your Quirk',
  appearance: 'Describe your Mech’s Appearance',
  pattern: 'Give your Mech a Name',
  review: 'Review',
}

type MechWizardProps = {
  /** Called on successful create/save with the mech's id. */
  onComplete: (mechId: string) => void
  /** Called when the user cancels. */
  onCancel: () => void
  /** Leaves the guided flow for the blank Free-Edit path (P3.3). Create only. */
  onOffRules?: () => void
  /**
   * Id of an existing mech being edited. When provided, handleSubmit takes
   * the update branch (never duplicates), the hard creation gates relax to
   * presence checks, budgets lift (no scrap/slot clamps or trackers), and
   * every option filter lifts (all TLs, all patterns — plan §5.2).
   */
  mechId?: string
  /**
   * Initial form state — pass `mechToFormState(mech)` in edit mode.
   * Defaults to the empty creation state.
   */
  initialState?: MechWizardFormState
}

/** Edit-mode gates: presence checks only (plan §5.2 — soft regime). */
function mechEditStepGate(step: MechWizardStepId, form: MechWizardFormState): StepGateResult {
  const hasChassis = form.chassisName !== ''
  const hasName = form.name.trim() !== ''
  switch (step) {
    case 'chassis':
      return hasChassis ? { ok: true } : { ok: false, reason: 'Choose a chassis to continue' }
    case 'pattern':
      return hasName ? { ok: true } : { ok: false, reason: 'Name your Mech to continue' }
    case 'review':
      if (!hasChassis) return { ok: false, reason: 'Choose a chassis to continue' }
      if (!hasName) return { ok: false, reason: 'Name your Mech to continue' }
      return { ok: true }
    default:
      return { ok: true }
  }
}

/** Slot pips for the tracker tab: ●●●○○ (capped so the tab stays a tab). */
function slotPips(used: number, max: number): string {
  if (max <= 0 || max > 12) return ''
  const filled = Math.max(0, Math.min(used, max))
  return `${'●'.repeat(filled)}${'○'.repeat(max - filled)} `
}

/**
 * Multi-step mech wizard on the shared WizShell skeleton, restructured to
 * the Mech Workshop's 8 book steps + Review (wizard-refresh Phase 4, plan
 * §4.2, mockup Screen 02) with the 20-Scrap economy enforced HARD (§5):
 *
 *   - illegal options are FILTERED OUT (Tech 1 chassis/systems/modules only;
 *     only `legalStarting` patterns in the prefill strip) — never rendered;
 *   - every purchase debits one shared 20-Scrap pool (`mechCreationBudget`
 *     on scrapCostFor) and the per-step slot budgets (computeMechCapacity);
 *     a `+` that would overspend disables, an unaffordable card dims with a
 *     reason chip — visible, never hidden;
 *   - exactly 1 chassis (radio); systems/modules are OPTIONAL (plan Q11);
 *     the pattern name is required — Next is gated by `mechCreationStepGate`
 *     and the unmet requirement renders in the footerNote;
 *   - chassis change refunds + wipes the loadout with a toast; draft-restore
 *     clamping is a deterministic knapsack (newest copies dropped first),
 *     always announced by toast;
 *   - Banner is REMOVED from the create flow — nothing can be in
 *     violation. Edit mode keeps the soft regime (§5.2).
 *
 * Guaranteed invariant at creation: chassis TL1 ∧ all items TL1 ∧
 * chassisSV + Σ(itemSV × count) ≤ 20 ∧ both slot budgets respected — every
 * guided mech is a legal starting mech by construction.
 */
export function MechWizard({
  onComplete,
  onCancel,
  onOffRules,
  mechId,
  initialState,
}: MechWizardProps) {
  const isEdit = mechId !== undefined
  const existingMech = useMech(mechId)
  const steps = isEdit ? EDIT_STEPS : CREATE_STEPS

  const [step, setStep] = useState<MechWizardStepId>(steps[0] ?? 'chassis')
  // Draft-aware init: a stored session draft (refresh, back-nav, PWA reload)
  // wins over the pristine initial state; cleared on submit/cancelled exit.
  // Create-mode drafts pass through the deterministic knapsack clamp (§5.3);
  // removals are announced once, by toast.
  const draftKey = wizardDraftKey('mech', mechId)
  const clampRemovedRef = useRef<string[] | null>(null)
  const [form, setForm] = useState<MechWizardFormState>(() => {
    const draft = readWizardDraft<MechWizardFormState>(draftKey)
    if (draft && !isEdit) {
      const { form: clamped, removed } = clampMechCreationDraft(draft)
      if (removed.length > 0) clampRemovedRef.current = removed
      return clamped
    }
    return draft ?? initialState ?? EMPTY_MECH_FORM_STATE
  })
  useEffect(() => {
    const removed = clampRemovedRef.current
    if (removed && removed.length > 0) {
      clampRemovedRef.current = null
      toast.info(`Draft trimmed to the starting rules — removed ${removed.join(', ')}.`)
    }
  }, [])
  const formDirty = useWizardDraftSync(draftKey, form, initialState ?? EMPTY_MECH_FORM_STATE)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentIndex = steps.indexOf(step)

  function updateForm(patch: Partial<MechWizardFormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  // ---------------------------------------------------------------------------
  // Budgets — the single source of truth (§5): the same numbers drive the
  // trackers, every SelCard's `+`/reason chip, and the Review gate.
  // ---------------------------------------------------------------------------
  const budget = useMemo(() => mechCreationBudgetFor(form), [form])

  const capacity = useMemo(
    () =>
      computeMechCapacity({
        chassisRef: form.chassisName,
        systems: form.systems.map((ref) => ({ ref })),
        modules: form.modules.map((ref) => ({ ref })),
      }),
    [form.chassisName, form.systems, form.modules]
  )
  const systemSlotsRemaining = Math.max(0, capacity.systemSlotsMax - capacity.systemSlotsUsed)
  const moduleSlotsRemaining = Math.max(0, capacity.moduleSlotsMax - capacity.moduleSlotsUsed)

  /**
   * Chassis pick (radio). Changing the chassis REFUNDS its scrap and wipes
   * the pattern + loadout (their arithmetic hangs off the chassis) — never a
   * silent mutation, the toast names what happened (§5.3).
   */
  function selectChassis(chassisSlug: string) {
    if (chassisSlug === form.chassisName) return
    const hadLoadout = form.systems.length > 0 || form.modules.length > 0 || form.patternName !== ''
    if (hadLoadout) {
      toast.info('Chassis changed — its Scrap refunded and the loadout cleared.')
    }
    updateForm({ chassisName: chassisSlug, patternName: '', systems: [], modules: [] })
  }

  /**
   * Canonical starting-pattern prefill (create step 2, plan §4.2): fills
   * steps 4–5 from the pattern (expanding per-entry `count`) and debits the
   * budget accordingly. The arithmetic stays enforced on the prefilled state
   * — `legalStarting` patterns fit by data, and the Review gate re-checks.
   */
  function selectPattern(pattern: ChassisPattern) {
    updateForm({
      patternName: pattern.name,
      name: form.name.trim() === '' ? pattern.name : form.name,
      systems: pattern.systems.flatMap((s) =>
        new Array<string>(s.count ?? 1).fill(nameToSlug(s.name))
      ),
      modules: pattern.modules.flatMap((m) =>
        new Array<string>(m.count ?? 1).fill(nameToSlug(m.name))
      ),
    })
  }

  /** Custom build: clear the prefill for a manual craft (idempotent-ish). */
  function selectCustom() {
    if (form.patternName === '' && form.systems.length === 0 && form.modules.length === 0) return
    toast.info('Custom build — pattern prefill cleared.')
    updateForm({ patternName: '', systems: [], modules: [] })
  }

  /**
   * Create-mode count-stepper write for systems/modules: duplicates allowed;
   * increments append copies (the caller already clamped `next` against both
   * budgets via maxCount); decrements drop the NEWEST copies first — the
   * same determinism as the draft knapsack clamp.
   */
  function setInstallCount(kind: 'systems' | 'modules', itemName: string, next: number) {
    const slug = nameToSlug(itemName)
    // Resolve the reference item so the count/match uses matchesRef (slug OR
    // legacy name OR id), matching CraftItemsStep's counting — otherwise a
    // legacy-name draft copy shows in the count but the `−` can't remove it.
    const item = kind === 'systems' ? resolveSystemRef(slug) : resolveModuleRef(slug)
    const isThis = (ref: string) => (item ? matchesRef(item, ref) : ref === slug)
    setForm((prev) => {
      const list = prev[kind]
      const current = list.filter(isThis).length
      const target = Math.max(0, next)
      if (target === current) return prev
      if (target > current) {
        return {
          ...prev,
          [kind]: [...list, ...new Array<string>(target - current).fill(slug)],
        }
      }
      let toRemove = current - target
      const kept: string[] = []
      for (let i = list.length - 1; i >= 0; i--) {
        const ref = list[i] as string
        if (isThis(ref) && toRemove > 0) {
          toRemove--
          continue
        }
        kept.unshift(ref)
      }
      return { ...prev, [kind]: kept }
    })
  }

  // Edit-mode installs keep the soft add/remove seam (InstallStep).
  function addCopy(kind: 'systems' | 'modules', name: string) {
    updateForm({ [kind]: [...form[kind], nameToSlug(name)] })
  }
  function removeAt(kind: 'systems' | 'modules', index: number) {
    updateForm({ [kind]: form[kind].filter((_, i) => i !== index) })
  }

  /** Step 8 writes name + patternName in LOCKSTEP — a mech's name IS its pattern. */
  function setMechName(value: string) {
    updateForm({ name: value, patternName: value })
  }

  // ---------------------------------------------------------------------------
  // Edit-mode extras (soft regime): live EP readout for InstallStep, and
  // advisory warnings — capacity everywhere, dependency checks on Review.
  // ---------------------------------------------------------------------------
  const chassis = useMemo(
    () => (form.chassisName ? resolveChassisRef(form.chassisName) : null),
    [form.chassisName]
  )
  const energyMax = mechMaxEP(
    {
      chassisRef: form.chassisName,
      systems: form.systems,
      modules: form.modules,
      maxEpModifier: existingMech?.maxEpModifier,
    },
    chassis
  )
  const energyValue = Math.min(existingMech?.currentEP ?? energyMax, energyMax)
  const loadoutName = form.name.trim() || chassis?.name || form.chassisName || 'Mech'

  const editWarnings = useMemo<SoftWarning[]>(() => {
    if (!isEdit) return []
    const warnings: SoftWarning[] = capacity.violations
      .filter((v) => v.kind === 'system-over-slots' || v.kind === 'module-over-slots')
      .map((v) => ({
        code: v.kind.toUpperCase().replace(/-/g, '_'),
        message: v.message,
        severity: 'warn',
      }))
    if (step === 'review') {
      const before = { systems: (existingMech?.systems ?? []).map((ref) => ({ ref })) }
      const after = { systems: form.systems.map((ref) => ({ ref })) }
      warnings.push(...evaluateMechWarnings({ before, after }, { entityType: 'mech' }))
    }
    return warnings
  }, [isEdit, step, capacity.violations, existingMech, form.systems])

  // Next-gating (§5.3): guided create runs the hard step gates; edit runs
  // presence checks. The gate's reason renders in the footerNote so a locked
  // Next always explains itself.
  const gate = isEdit ? mechEditStepGate(step, form) : mechCreationStepGate(step, form)

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
      if (mechId) {
        await store.update('mech', mechId, mechFormToUpdatePatch(form))
        toast.success(`Saved ${form.name.trim() || 'mech'}.`)
        clearWizardDraft(draftKey)
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
      toast.success(`Saved ${form.name.trim() || 'mech'}.`)
      clearWizardDraft(draftKey)
      onComplete(created.id)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save mech. Please retry.')
      setIsSubmitting(false)
    }
  }

  // Per-step RuleBrief: the Core Book's own Mech Workshop copy, pp.94–95
  // (create); edit variants describe the lifted soft regime.
  const stepRule: StepRule = (() => {
    switch (step) {
      case 'scrap':
        return {
          rule: 'You start with 20 Tech 1 Scrap. You will use this Scrap to craft your first Mech. This is built out of a Tech 1 Mech Chassis and any number of Tech 1 Systems and Modules installed on the Mech Chassis. Any spare Scrap you have after this can be stored in your Union Crawler and be used later on in the game.',
          cite: 'Core Book · p.94 · The Union Crawler p.212',
        }
      case 'chassis':
        return isEdit
          ? {
              rule: 'Choose your Mech Chassis — any tech level, any pattern. Changing the chassis clears the installed loadout; capacity overages warn, never block.',
              cite: 'Core Book · pp.94–95',
            }
          : {
              rule: 'Craft a Tech 1 Mech Chassis of your choice from the Mech Chassis Blueprints list. This costs an amount of Tech 1 Scrap equal to its Salvage Value as per the normal crafting rules. For example, a Mule Mech has a Salvage Value of 7 so would cost 7 Tech 1 Scrap to craft.',
              cite: 'Core Book · p.94 · Mech Chassis pp.100–159',
            }
      case 'stats':
        return {
          rule: 'Your Mech has a set of statistics unique to its Chassis. This includes its Structure Points, Heat Capacity, Energy Points, System Slots, Module Slots, Salvage Value, Type, and Chassis Ability. Note these down on your Mech Sheet.',
          cite: 'Core Book · p.95 · Mech statistics p.96',
        }
      case 'systems':
        return isEdit
          ? {
              rule: 'Install Systems — any tech level, beyond slots if you like. Over-capacity warns on the sheet, never blocks.',
              cite: 'Core Book · p.95',
            }
          : {
              rule: 'You now craft Tech 1 Systems from the System Blueprints list to install on your Mech. Each System costs its Salvage Value in Tech 1 Scrap to craft, as per the normal crafting rules. For example, a Locomotion System has a Salvage Value of 2, so costs 2 Tech 1 Scrap to craft. A Mech can only install as many Systems as it has System slots.',
              cite: 'Core Book · p.95 · The System list p.162',
            }
      case 'modules':
        return isEdit
          ? {
              rule: 'Install Modules — any tech level, beyond slots if you like. Over-capacity warns on the sheet, never blocks.',
              cite: 'Core Book · p.95',
            }
          : {
              rule: 'Next, you may craft Tech 1 Modules from the Module Blueprints list to install on your Mech. Each Module costs its Salvage Value in Tech 1 Scrap to craft, as per the normal crafting rules. For example, a Comms Module has a Salvage Value of 1, so costs 1 Tech 1 Scrap to craft. A Mech can only install as many Modules as it has Module Slots.',
              cite: 'Core Book · p.95 · The Modules list p.188',
            }
      case 'quirk':
        return {
          rule: 'In addition to the Systems and Modules you have installed in your Mech, you can also give it a unique Quirk that will make it stand out from other Mechs. For example, their comms and sensor array could look like rabbit ears or they might make beeping noises when being operated. Either roll on the Quirks Table or create one yourself.',
          cite: 'Core Book · p.95 · Quirks Table p.208',
        }
      case 'appearance':
        return {
          rule: 'Describe the appearance of your Mech. The Mech Chassis is simply an example of the Mech in its stock form before a salvager gets their hands on it. Your Mech can take on any appearance that you can imagine.',
          cite: 'Core Book · p.94 · Mech Appearance Table p.208',
        }
      case 'pattern':
        return {
          rule: 'Finally give your Mech a unique pattern name that marks it as your own creation. This could be something like ‘Butcher’, ‘Slinky’, ‘Bullseye’, or ‘Roach’. For example: if you built a Mule with Zoom Optics and a Red Laser, you might want to call it a ‘Bullseye Pattern Mule’.',
          cite: 'Core Book · p.94 · Pattern Name Table p.209',
        }
      case 'review':
        return {
          rule: isEdit
            ? 'Check the changes, then save.'
            : 'Check the build, then create your Mech. Whatever Scrap you did not spend banks to your Union Crawler.',
          cite: isEdit ? undefined : 'Core Book · pp.94–95',
        }
    }
  })()

  // Tracker tabs in the action pill (create only — edit lifts the budgets):
  // the SCRAP tab debuts on step 1 and rides along wherever scrap can move;
  // the slot pip chips join on their own crafting steps (mockup Screen 02).
  const trackers = (() => {
    if (isEdit) return undefined
    const scrap = (
      <WizTracker
        label="Scrap"
        value={
          <span data-testid="scrap-remaining">
            {budget.remaining} / {MECH_CREATION_SCRAP_CAP}
          </span>
        }
      />
    )
    switch (step) {
      case 'systems':
        return (
          <>
            {scrap}
            <WizTracker
              label="System Slots"
              value={
                <span data-testid="system-slot-count">
                  {slotPips(capacity.systemSlotsUsed, capacity.systemSlotsMax)}
                  {capacity.systemSlotsUsed} / {capacity.systemSlotsMax}
                </span>
              }
            />
          </>
        )
      case 'modules':
        return (
          <>
            {scrap}
            <WizTracker
              label="Module Slots"
              value={
                <span data-testid="module-slot-count">
                  {slotPips(capacity.moduleSlotsUsed, capacity.moduleSlotsMax)}
                  {capacity.moduleSlotsUsed} / {capacity.moduleSlotsMax}
                </span>
              }
            />
          </>
        )
      case 'quirk':
      case 'appearance':
      case 'pattern':
        return undefined // flavor steps: nothing debits — keep the pill quiet
      default:
        return scrap
    }
  })()

  // Systems/modules are OPTIONAL (plan Q11) — say so where a player might
  // expect a block; otherwise surface the gate reason on a locked Next.
  const footerNote = !gate.ok
    ? gate.reason
    : !isEdit && step === 'systems'
      ? 'Systems are optional · spare slots are fine'
      : !isEdit && step === 'modules'
        ? 'Modules are optional · spare slots are fine'
        : undefined

  return (
    <WizShell
      kind="mech"
      eyebrow={isEdit ? 'Edit Mech' : 'Mech Workshop'}
      steps={steps.map((s) => STEP_LABELS[s])}
      active={currentIndex}
      onStepClick={(i) => {
        const s = steps[i]
        if (s) setStep(s)
      }}
      title={STEP_TITLES[step]}
      tintedStepCard
      notice={isEdit && editWarnings.length > 0 ? <Banner warnings={editWarnings} /> : undefined}
      trackers={trackers}
      footerNote={footerNote}
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
      submitLabel={isEdit ? 'Save Mech' : 'Create Mech ✦'}
    >
      <RuleBrief rule={stepRule.rule} cite={stepRule.cite} className="mb-5" />
      {step === 'scrap' && <GainScrapStep />}
      {step === 'chassis' && (
        <MechChassisStep
          isEdit={isEdit}
          chassisName={form.chassisName}
          patternName={form.patternName}
          onSelectChassis={selectChassis}
          onSelectPattern={selectPattern}
          onSelectCustom={selectCustom}
        />
      )}
      {step === 'stats' && <MechStatsStep chassisName={form.chassisName} />}
      {step === 'systems' &&
        (isEdit ? (
          <InstallStep
            kind="systems"
            selected={form.systems}
            onAdd={(name) => addCopy('systems', name)}
            onRemove={(index) => removeAt('systems', index)}
            loadoutName={loadoutName}
            slotsUsed={capacity.systemSlotsUsed}
            slotsMax={capacity.systemSlotsMax}
            energyValue={energyValue}
            energyMax={energyMax}
          />
        ) : (
          <CraftItemsStep
            kind="systems"
            selected={form.systems}
            onCountChange={(name, next) => setInstallCount('systems', name, next)}
            scrapRemaining={budget.remaining}
            slotsRemaining={systemSlotsRemaining}
          />
        ))}
      {step === 'modules' &&
        (isEdit ? (
          <InstallStep
            kind="modules"
            selected={form.modules}
            onAdd={(name) => addCopy('modules', name)}
            onRemove={(index) => removeAt('modules', index)}
            loadoutName={loadoutName}
            slotsUsed={capacity.moduleSlotsUsed}
            slotsMax={capacity.moduleSlotsMax}
            energyValue={energyValue}
            energyMax={energyMax}
          />
        ) : (
          <CraftItemsStep
            kind="modules"
            selected={form.modules}
            onCountChange={(name, next) => setInstallCount('modules', name, next)}
            scrapRemaining={budget.remaining}
            slotsRemaining={moduleSlotsRemaining}
          />
        ))}
      {step === 'quirk' && (
        <MechFlavorStep
          field="quirk"
          label="Quirk"
          value={form.quirk}
          onChange={(quirk) => updateForm({ quirk })}
          placeholder="e.g. Rattletrap — sounds like it's dying even when it's fine."
        />
      )}
      {step === 'appearance' && (
        <MechFlavorStep
          field="appearance"
          label="Appearance"
          value={form.appearance}
          onChange={(appearance) => updateForm({ appearance })}
          placeholder="How it looks — plating, paint, silhouette."
          multiline
        />
      )}
      {step === 'pattern' && (
        <MechFlavorStep
          field="patternName"
          label="Name / Pattern"
          value={form.name}
          onChange={setMechName}
          placeholder="e.g. Bullseye Pattern Mule"
          note="A mech's name IS its pattern — one name covers both."
        />
      )}
      {step === 'review' && (
        <MechReviewStep
          form={form}
          isEdit={isEdit}
          submitError={submitError}
          bankedScrap={isEdit ? undefined : Math.max(0, budget.remaining)}
        />
      )}
    </WizShell>
  )
}
