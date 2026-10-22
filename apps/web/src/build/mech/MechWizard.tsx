import { MechSchema } from 'game-domain/schemas/mech'
import { useMemo } from 'react'
import { bookQuote, nameToSlug } from 'salvageunion-reference'
import { computeMechCapacity, MECH_CREATION_SCRAP_CAP } from 'salvageunion-reference/rules'
import { slotPips } from '../../components/atoms/pipRows'
import { toast } from '../../components/index'
import type { MechWizardStepId } from '../../lib/rules/creation'
import {
  clampMechCreationDraft,
  mechCreationBudgetFor,
  mechCreationStepGate,
} from '../../lib/rules/creation'
import type { MechPattern, MechWizardFormState } from '../../lib/wizard/mechFormState'
import {
  EMPTY_MECH_FORM_STATE,
  mechFormToCreateInput,
  withPatternPrefill,
} from '../../lib/wizard/mechFormState'
import { withMechPreselection } from '../../lib/wizard/preselect'
import '../../styles/build/wizard.css'
import { GainScrapStep } from '../wizard/GainScrapStep'
import { MechFlavorStep } from '../wizard/MechFlavorStep'
import type { StepRule } from '../wizard/RuleBrief'
import { RuleBrief } from '../wizard/RuleBrief'
import { useWizardDraft } from '../wizard/useWizardDraft'
import { useWizardFlow } from '../wizard/useWizardFlow'
import { WizShell, WizTracker } from '../wizard/WizShell'
import { CraftItemsStep } from './CraftItemsStep'
import type { ChassisPattern } from './MechChassisStep'
import { MechChassisStep } from './MechChassisStep'
import { MechReviewStep } from './MechReviewStep'
import { MechStatsStep } from './MechStatsStep'

/** Book-order steps (Mech Workshop pp.94–95 + Review). */
const STEPS: readonly MechWizardStepId[] = [
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

/** Stepper-rail labels. */
const STEP_LABELS: Record<MechWizardStepId, string> = {
  scrap: 'Gain Scrap',
  chassis: 'Craft your Chassis',
  stats: 'Mech Statistics',
  systems: 'Craft your Systems',
  modules: 'Craft your Modules',
  quirk: 'Quirk',
  appearance: 'Appearance',
  pattern: 'Pattern name',
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
  /** Called on successful create with the mech's id. */
  onComplete: (mechId: string) => void
  /** Called when the user cancels. */
  onCancel: () => void
  /** Leaves the guided flow for the blank Free-Edit path (P3.3). */
  onOffRules?: () => void
  /** The Game the new unit lands in (`?game=<id>`, ADR-052 §3); unset, the store decides. */
  gameId?: string | undefined
  /** A chassis slug to start on (`?chassis=`), already checked by `preselectedChassis`. */
  preselectChassis?: string
  /** That chassis's pattern to prefill (`?pattern=`), already checked by `preselectedPattern`. */
  preselectPattern?: MechPattern
}

/**
 * Multi-step mech wizard on the shared WizShell skeleton, restructured to
 * the Mech Workshop's 8 book steps + Review with the
 * 20-Scrap economy enforced HARD (§5):
 *
 *   - illegal options are FILTERED OUT (Tech 1 chassis/systems/modules only;
 *     only `legalStarting` patterns in the prefill strip) — never rendered;
 *   - every purchase debits one shared 20-Scrap pool (`mechCreationBudget`
 *     on scrapCostFor) and the per-step slot budgets (computeMechCapacity);
 *     a `+` that would overspend disables, an unaffordable card dims with a
 *     reason chip — visible, never hidden;
 *   - exactly 1 chassis (radio); systems/modules are OPTIONAL;
 *     the pattern name is required — Next is gated by `mechCreationStepGate`
 *     and the unmet requirement renders in the footerNote;
 *   - chassis change refunds + wipes the loadout with a toast; draft-restore
 *     clamping is a deterministic knapsack (newest copies dropped first),
 *     always announced by toast;
 *   - there is no warnings Banner — nothing can be in violation.
 *
 * Guaranteed invariant at creation: chassis TL1 ∧ all items TL1 ∧
 * chassisSV + Σ(itemSV × count) ≤ 20 ∧ both slot budgets respected — every
 * guided mech is a legal starting mech by construction.
 */
export function MechWizard({
  onComplete,
  onCancel,
  onOffRules,
  gameId,
  preselectChassis,
  preselectPattern,
}: MechWizardProps) {
  // The session draft (`useWizardDraft`): the deterministic knapsack clamp
  // (§5.3), and a deep-linked `?chassis=` / `?pattern=` is the baseline.
  const baseline = useMemo(
    () => withMechPreselection(EMPTY_MECH_FORM_STATE, preselectChassis, preselectPattern),
    [preselectChassis, preselectPattern]
  )
  const { form, setForm, formDirty, draftKey } = useWizardDraft<MechWizardFormState>('mech', {
    baseline,
    clamp: clampMechCreationDraft,
    reapply: (restored) => withMechPreselection(restored, preselectChassis, preselectPattern),
  })

  // The step machine + the create submit, shared with the pilot, crawler and
  // NPC wizards (`useWizardFlow`); the mech's create input is a plain projection
  // of the form.
  const { step, gate, submitError, shell } = useWizardFlow({
    entityType: 'mech',
    noun: 'mech',
    steps: STEPS,
    stepLabels: STEP_LABELS,
    gateFor: (s) => mechCreationStepGate(s, form),
    initialStep: 'scrap',
    submitStep: 'review',
    form,
    draftKey,
    formDirty,
    schema: MechSchema,
    toCreateInput: mechFormToCreateInput,
    failureMessage: 'The mech could not be saved. Try again.',
    onComplete,
    onCancel,
    onOffRules,
    gameId,
  })

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
   * Canonical starting-pattern prefill (create step 2): fills
   * steps 4–5 from the pattern (expanding per-entry `count`) and debits the
   * budget accordingly. The arithmetic stays enforced on the prefilled state
   * — `legalStarting` patterns fit by data, and the Review gate re-checks.
   */
  function selectPattern(pattern: ChassisPattern) {
    setForm((prev) => withPatternPrefill(prev, pattern))
  }

  /** Custom build: clear the prefill for a manual craft (idempotent-ish). */
  function selectCustom() {
    if (form.patternName === '' && form.systems.length === 0 && form.modules.length === 0) return
    toast.info('Custom build — pattern prefill cleared.')
    updateForm({ patternName: '', systems: [], modules: [] })
  }

  /**
   * Count-stepper write for systems/modules: duplicates allowed;
   * increments append copies (the caller already clamped `next` against both
   * budgets via maxCount); decrements drop the NEWEST copies first — the
   * same determinism as the draft knapsack clamp.
   */
  function setInstallCount(kind: 'systems' | 'modules', itemName: string, next: number) {
    const slug = nameToSlug(itemName)
    const isThis = (ref: string) => ref === slug
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

  /** Step 8 writes name + patternName in LOCKSTEP — a mech's name IS its pattern. */
  function setMechName(value: string) {
    updateForm({ name: value, patternName: value })
  }

  // Per-step RuleBrief: the Core Book's own Mech Workshop copy, pp.94–95,
  // each quote a `bookQuote` so the rules-fidelity lock holds it to the book.
  const stepRule: StepRule = (() => {
    switch (step) {
      case 'scrap':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 94 },
            'You start with 20 Tech 1 Scrap. You will use this Scrap to craft your first Mech. This is built out of a Tech 1 Mech Chassis and any number of Tech 1 Systems and Modules installed on the Mech Chassis. Any spare Scrap you have after this can be stored in your Union Crawler and be used later on in the game.'
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 94,
            see: [{ label: 'The Union Crawler', page: 212 }],
          },
        }
      case 'chassis':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 94 },
            'Craft a Tech 1 Mech Chassis of your choice from the Mech Chassis Blueprints list. This costs an amount of Tech 1 Scrap equal to its Salvage Value as per the normal crafting rules. For example, a Mule Mech has a Salvage Value of 7 so would cost 7 Tech 1 Scrap to craft.'
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 94,
            see: [{ label: 'Mech Chassis', page: [100, 159] }],
          },
        }
      case 'stats':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 95 },
            'Your Mech has a set of statistics unique to its Chassis. This includes its Structure Points, Heat Capacity, Energy Points, System Slots, Module Slots, Salvage Value, Type, and Chassis Ability. Note these down on your Mech Sheet.'
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 95,
            see: [{ label: 'Mech statistics', page: 96 }],
          },
        }
      case 'systems':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 95 },
            'You now craft Tech 1 Systems from the System Blueprints list to install on your Mech. Each System costs its Salvage Value in Tech 1 Scrap to craft, as per the normal crafting rules. For example, a Locomotion System has a Salvage Value of 2, so costs 2 Tech 1 Scrap to craft. A Mech can only install as many Systems as it has System slots.'
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 95,
            see: [{ label: 'The System list', page: 162 }],
          },
        }
      case 'modules':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 95 },
            'Next, you may craft Tech 1 Modules from the Module Blueprints list to install on your Mech. Each Module costs its Salvage Value in Tech 1 Scrap to craft, as per the normal crafting rules. For example, a Comms Module has a Salvage Value of 1, so costs 1 Tech 1 Scrap to craft. A Mech can only install as many Modules as it has Module Slots.'
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 95,
            see: [{ label: 'The Modules list', page: 188 }],
          },
        }
      case 'quirk':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 95 },
            'In addition to the Systems and Modules you have installed in your Mech, you can also give it a unique Quirk that will make it stand out from other Mechs. For example, their comms and sensor array could look like rabbit ears or they might make beeping noises when being operated. Either roll on the Quirks Table or create one yourself.'
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 95,
            see: [{ label: 'Quirks Table', page: 208 }],
          },
        }
      case 'appearance':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 94 },
            'Describe the appearance of your Mech. The Mech Chassis is simply an example of the Mech in its stock form before a salvager gets their hands on it. Your Mech can take on any appearance that you can imagine.'
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 94,
            see: [{ label: 'Mech Appearance Table', page: 208 }],
          },
        }
      case 'pattern':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 94 },
            'Finally give your Mech a unique pattern name that marks it as your own creation. This could be something like ‘Butcher’, ‘Slinky’, ‘Bullseye’, or ‘Roach’. For example: if you built a Mule with Zoom Optics and a Red Laser, you might want to call it a ‘Bullseye Pattern Mule’.'
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 94,
            see: [{ label: 'Pattern Name Table', page: 209 }],
          },
        }
      case 'review':
        return {
          rule: 'Check the build, then create your Mech. Whatever Scrap you did not spend banks to your Union Crawler.',
          cite: { source: 'Salvage Union Workshop Manual', page: [94, 95] },
        }
    }
  })()

  // Tracker tabs in the action pill: the SCRAP tab debuts on step 1 and rides
  // along wherever scrap can move; the slot pip chips join on their own
  // crafting steps.
  const trackers = (() => {
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

  // Systems/modules are OPTIONAL — say so where a player might
  // expect a block; otherwise surface the gate reason on a locked Next.
  const footerNote = !gate.ok
    ? gate.reason
    : step === 'systems'
      ? 'Systems are optional · spare slots are fine'
      : step === 'modules'
        ? 'Modules are optional · spare slots are fine'
        : undefined

  return (
    <WizShell
      gameId={gameId}
      kind="mech"
      eyebrow="Mech Workshop"
      {...shell}
      title={STEP_TITLES[step]}
      trackers={trackers}
      footerNote={footerNote}
      submitLabel="Create Mech ✦"
    >
      <RuleBrief rule={stepRule.rule} cite={stepRule.cite} className="su-wiz-rule-brief" />
      {step === 'scrap' && <GainScrapStep />}
      {step === 'chassis' && (
        <MechChassisStep
          chassisName={form.chassisName}
          patternName={form.patternName}
          onSelectChassis={selectChassis}
          onSelectPattern={selectPattern}
          onSelectCustom={selectCustom}
        />
      )}
      {step === 'stats' && <MechStatsStep chassisName={form.chassisName} />}
      {step === 'systems' && (
        <CraftItemsStep
          kind="systems"
          selected={form.systems}
          onCountChange={(name, next) => setInstallCount('systems', name, next)}
          scrapRemaining={budget.remaining}
          slotsRemaining={systemSlotsRemaining}
        />
      )}
      {step === 'modules' && (
        <CraftItemsStep
          kind="modules"
          selected={form.modules}
          onCountChange={(name, next) => setInstallCount('modules', name, next)}
          scrapRemaining={budget.remaining}
          slotsRemaining={moduleSlotsRemaining}
        />
      )}
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
          submitError={submitError}
          bankedScrap={Math.max(0, budget.remaining)}
        />
      )}
    </WizShell>
  )
}
