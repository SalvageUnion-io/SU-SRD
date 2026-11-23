import { MechSchema } from 'game-domain/schemas/mech'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import type { BookCite, ChoiceSelections } from 'salvageunion-reference'
import { bookQuote, nameToSlug } from 'salvageunion-reference'
import { computeMechCapacity, MECH_CREATION_SCRAP_CAP } from 'salvageunion-reference/rules'
import { toast } from '../../components/index'
import {
  clampMechCreationDraft,
  mechCreationBudgetFor,
  mechCreationStepGate,
} from '../../lib/rules/creation'
import { hasIntegratedLocomotion } from '../../lib/rules/locomotion'
import { withItemChoice } from '../../lib/wizard/itemChoices'
import type { MechPattern, MechWizardFormState } from '../../lib/wizard/mechFormState'
import {
  EMPTY_MECH_FORM_STATE,
  leftoverScrapSplit,
  mechFormToCreateInput,
  withLeftoverScrap,
  withPatternPrefill,
} from '../../lib/wizard/mechFormState'
import { withMechPreselection } from '../../lib/wizard/preselect'
import { mechCopy } from '../../messages/build-mech'
import { routesCopy } from '../../messages/routes'
import { MechFlavorStep } from '../wizard/MechFlavorStep'
import type { StepRule } from '../wizard/RuleBrief'
import { RuleBrief } from '../wizard/RuleBrief'
import { useWizardDraft } from '../wizard/useWizardDraft'
import { useWizardFlow } from '../wizard/useWizardFlow'
import { WizTracker } from '../wizard/WizBudget'
import { WizShell } from '../wizard/WizShell'
import { PATTERN_STRIP_ID } from './chassisColumns.model'
import type { ChassisPattern } from './MechChassisStep'
import { MechChassisStep } from './MechChassisStep'
import { MechLoadoutStep } from './MechLoadoutStep'
import { MechReviewStep } from './MechReviewStep'

/**
 * The book's nine steps (pp.94–95) as four, each one a decision (N6: a step
 * asks for something). "Gain Scrap" is step 1's cited rule; "Note down your
 * Statistics" is the picked chassis's card; Systems and Modules share a step;
 * Quirk and Appearance share one; the name leads the review. The book's own
 * words stay in the rule briefs.
 */
type MechStep = 'chassis' | 'loadout' | 'look' | 'review'

const STEPS: readonly MechStep[] = ['chassis', 'loadout', 'look', 'review']

/** Stepper-rail labels (also the Next button's: it names the step it opens). */
const STEP_LABELS: Record<MechStep, string> = {
  chassis: mechCopy('chassis'),
  loadout: mechCopy('systemsModules'),
  look: mechCopy('quirkLook'),
  review: mechCopy('nameReview'),
}

/** Step headings. */
const STEP_TITLES: Record<MechStep, string> = {
  chassis: mechCopy('chooseAChassis'),
  loadout: mechCopy('craftYourSystemsAnd'),
  look: mechCopy('giveItAQuirk'),
  review: mechCopy('nameYourMechAnd'),
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

/** Where the book prints each list's rule (the lists' feet). */
const BOOK = 'Salvage Union Workshop Manual'
const LIST_CITES = {
  systems: { source: BOOK, page: 95, see: [{ label: mechCopy('systems'), page: [162, 187] }] },
  modules: { source: BOOK, page: 95, see: [{ label: mechCopy('modules'), page: [188, 207] }] },
} satisfies Record<string, BookCite>

/**
 * The mech wizard on the shared WizShell skeleton: the Mech Workshop's book
 * steps as four (above), with the 20-Scrap economy enforced HARD (§5):
 *
 *   - illegal options are FILTERED OUT (Tech 1 chassis/systems/modules only;
 *     only `legalStarting` patterns in the prefill strip) — never rendered;
 *   - every purchase debits one shared 20-Scrap pool (`mechCreationBudget`
 *     on scrapCostFor) and the per-step slot budgets (computeMechCapacity);
 *     a `+` that would overspend disables, an unaffordable line dims and
 *     says why — visible, never hidden;
 *   - exactly 1 chassis (radio); systems/modules are OPTIONAL;
 *     the pattern name is required — Next is gated by `mechCreationStepGate`
 *     and the unmet requirement shows on the step (`footerNote`);
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
  const { step, gate, submitError, shell, askSignIn, goTo } = useWizardFlow({
    entityType: 'mech',
    noun: 'mech',
    steps: STEPS,
    stepLabels: STEP_LABELS,
    // A merged step answers to its book steps' own gates.
    gateFor: (s) =>
      s === 'chassis'
        ? mechCreationStepGate('chassis', form)
        : s === 'review'
          ? mechCreationStepGate('review', form)
          : mechCreationStepGate('systems', form),
    // A Reference pattern's link opens at the review, its pattern chosen (r6 E6).
    initialStep: preselectPattern ? 'review' : 'chassis',
    submitStep: 'review',
    form,
    draftKey,
    formDirty,
    schema: MechSchema,
    // Unspent Scrap is carried in the new mech's hold as far as it fits (r3 F1).
    toCreateInput: (f) =>
      mechFormToCreateInput(withLeftoverScrap(f, mechCreationBudgetFor(f).remaining)),
    failureMessage: mechCopy('theMechCouldNotBe'),
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
  // trackers, every line's `+` and reason, and the Review gate.
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

  /**
   * Chassis pick (radio). Changing the chassis REFUNDS its scrap and wipes
   * the pattern + loadout (their arithmetic hangs off the chassis) — never a
   * silent mutation, the toast names what happened (§5.3).
   */
  function selectChassis(chassisSlug: string) {
    if (chassisSlug === form.chassisName) return
    const hadLoadout = form.systems.length > 0 || form.modules.length > 0 || form.patternName !== ''
    if (hadLoadout) {
      toast.info(mechCopy('chassisChangedItsScrapRefunded'))
    }
    updateForm({ chassisName: chassisSlug, patternName: '', systems: [], modules: [] })
  }

  /**
   * Canonical starting-pattern prefill (create step 2): fills
   * steps 4–5 from the pattern (expanding per-entry `count`) and debits the
   * budget accordingly. The arithmetic stays enforced on the prefilled state
   * — `legalStarting` patterns fit by data, and the Review gate re-checks.
   * A pattern is a whole build, so its pick opens Name & Review; Systems and
   * Quirk stay one press back on the rail (r7 F9).
   */
  function selectPattern(pattern: ChassisPattern) {
    setForm((prev) => withPatternPrefill(prev, pattern))
    goTo('review')
  }

  /** Custom build: clear the prefill for a manual craft (idempotent-ish). */
  function selectCustom() {
    if (form.patternName === '' && form.systems.length === 0 && form.modules.length === 0) return
    toast.info(mechCopy('customBuildPatternPrefillCleared'))
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

  /** The name is the mech's, and so its pattern's; the book pattern it started from stays as provenance. */
  function setMechName(value: string) {
    updateForm({ name: value })
  }

  /** An option chosen on an installed item (`Mech.itemChoices`), saved with the mech. */
  function setItemChoice(slug: string, next: ChoiceSelections) {
    setForm((prev) => ({ ...prev, itemChoices: withItemChoice(prev.itemChoices, slug, next) }))
  }

  // Per-step RuleBrief: the Core Book's own Mech Workshop copy, pp.94–95,
  // each quote a `bookQuote` so the rules-fidelity lock holds it to the book.
  // Kept by the book step each part of a step answers to.
  type BookStep = 'scrap' | 'systems' | 'modules' | 'quirk' | 'appearance' | 'pattern'
  const ruleFor = (bookStep: BookStep): StepRule => {
    switch (bookStep) {
      case 'scrap':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 94 },
            'You start with 20 Tech 1 Scrap. You will use this Scrap to craft your first Mech. This is built out of a Tech 1 Mech Chassis and any number of Tech 1 Systems and Modules installed on the Mech Chassis. Any spare Scrap you have after this can be stored in your Union Crawler and be used later on in the game.'
          ),
          cite: {
            source: BOOK,
            page: 94,
            see: [{ label: mechCopy('theUnionCrawler'), page: 212 }],
          },
        }
      case 'systems':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 95 },
            'You now craft Tech 1 Systems from the System Blueprints list to install on your Mech. Each System costs its Salvage Value in Tech 1 Scrap to craft, as per the normal crafting rules. For example, a Locomotion System has a Salvage Value of 2, so costs 2 Tech 1 Scrap to craft. A Mech can only install as many Systems as it has System slots.'
          ),
          cite: {
            source: BOOK,
            page: 95,
            see: [{ label: mechCopy('theSystemList'), page: 162 }],
          },
        }
      case 'modules':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 95 },
            'Next, you may craft Tech 1 Modules from the Module Blueprints list to install on your Mech. Each Module costs its Salvage Value in Tech 1 Scrap to craft, as per the normal crafting rules. For example, a Comms Module has a Salvage Value of 1, so costs 1 Tech 1 Scrap to craft. A Mech can only install as many Modules as it has Module Slots.'
          ),
          cite: {
            source: BOOK,
            page: 95,
            see: [{ label: mechCopy('theModulesList'), page: 188 }],
          },
        }
      case 'quirk':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 95 },
            'In addition to the Systems and Modules you have installed in your Mech, you can also give it a unique Quirk that will make it stand out from other Mechs. For example, their comms and sensor array could look like rabbit ears or they might make beeping noises when being operated. Either roll on the Quirks Table or create one yourself.'
          ),
          cite: {
            source: BOOK,
            page: 95,
            see: [{ label: mechCopy('quirksTable'), page: 208 }],
          },
        }
      case 'appearance':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 94 },
            'Describe the appearance of your Mech. The Mech Chassis is simply an example of the Mech in its stock form before a salvager gets their hands on it. Your Mech can take on any appearance that you can imagine.'
          ),
          cite: {
            source: BOOK,
            page: 94,
            see: [{ label: mechCopy('mechAppearanceTable'), page: 208 }],
          },
        }
      case 'pattern':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 94 },
            'Finally give your Mech a unique pattern name that marks it as your own creation. This could be something like ‘Butcher’, ‘Slinky’, ‘Bullseye’, or ‘Roach’. For example: if you built a Mule with Zoom Optics and a Red Laser, you might want to call it a ‘Bullseye Pattern Mule’.'
          ),
          cite: {
            source: BOOK,
            page: 94,
            see: [{ label: mechCopy('patternNameTable'), page: 209 }],
          },
        }
    }
  }
  const brief = (bookStep: BookStep) => {
    const { rule, cite } = ruleFor(bookStep)
    return <RuleBrief rule={rule} cite={cite} className="su-wiz-rule-brief" fold />
  }

  /** A part of a step: its field in the brief's frame, over the book's words for it. */
  const part = (bookStep: BookStep, field: ReactNode) => {
    const { rule, cite } = ruleFor(bookStep)
    return (
      <RuleBrief rule={rule} cite={cite} className="su-wiz-rule-brief" fold>
        {field}
      </RuleBrief>
    )
  }

  // The action bar's budgets. Scrap rides every step that can spend it; the
  // slot counts join it on step 2 from sm (a phone's bar is one budget, and
  // the step's own meters show all three).
  const trackers = (() => {
    const scrap = (
      // Spent, as the slots read filled: every budget counts up to its cap.
      <WizTracker
        label={mechCopy('scrapSpent')}
        short={mechCopy('scrap')}
        value={MECH_CREATION_SCRAP_CAP - budget.remaining}
        max={MECH_CREATION_SCRAP_CAP}
        testId="scrap-spent"
      />
    )
    switch (step) {
      case 'loadout':
        return (
          <>
            {scrap}
            <span className="su-wiz-pill-wide">
              <WizTracker
                label={mechCopy('systemSlots')}
                short={mechCopy('sys')}
                value={capacity.systemSlotsUsed}
                max={capacity.systemSlotsMax}
                testId="system-slot-count"
              />
            </span>
            <span className="su-wiz-pill-wide">
              <WizTracker
                label={mechCopy('moduleSlots')}
                short={mechCopy('mod')}
                value={capacity.moduleSlotsUsed}
                max={capacity.moduleSlotsMax}
                testId="module-slot-count"
              />
            </span>
          </>
        )
      case 'look':
        return undefined // flavor step: nothing debits — keep the bar quiet
      default:
        return scrap
    }
  })()

  // A locked Next's reason, on the step it locks.
  const footerNote = !gate.ok ? gate.reason : undefined

  return (
    <WizShell
      gameId={gameId}
      kind="mech"
      eyebrow={routesCopy('newMech')}
      {...shell}
      title={STEP_TITLES[step]}
      trackers={trackers}
      footerNote={footerNote}
      // The pattern strip opens under the chassis gallery, out of sight on a phone.
      prompt={
        step === 'chassis' && form.chassisName !== '' && form.patternName === ''
          ? { text: mechCopy('orStartFromAPattern'), targetId: PATTERN_STRIP_ID }
          : undefined
      }
      submitLabel={mechCopy('createMech')}
    >
      {step === 'chassis' && (
        <>
          {/* The book's "Gain Scrap" step asks nothing: it is step 1's cited rule. */}
          {brief('scrap')}
          <MechChassisStep
            chassisName={form.chassisName}
            patternName={form.patternName}
            onSelectChassis={selectChassis}
            onSelectPattern={selectPattern}
            onSelectCustom={selectCustom}
            gameId={gameId}
          />
        </>
      )}
      {step === 'loadout' && (
        <>
          <div className="su-wiz-parts">
            {brief('systems')}
            {brief('modules')}
          </div>
          <MechLoadoutStep
            systems={form.systems}
            modules={form.modules}
            onCountChange={setInstallCount}
            scrapRemaining={budget.remaining}
            ownLocomotion={hasIntegratedLocomotion(form.chassisName)}
            slots={{
              systems: { used: capacity.systemSlotsUsed, max: capacity.systemSlotsMax },
              modules: { used: capacity.moduleSlotsUsed, max: capacity.moduleSlotsMax },
            }}
            choices={form.itemChoices}
            onChoices={setItemChoice}
            cites={LIST_CITES}
          />
        </>
      )}
      {step === 'look' && (
        // Each part is one box, the field over the book's words for it, the
        // two side by side where there is room.
        <div className="su-wiz-parts">
          {part(
            'quirk',
            <MechFlavorStep
              field="quirk"
              label={mechCopy('quirk')}
              value={form.quirk}
              onChange={(quirk) => updateForm({ quirk })}
              placeholder={mechCopy('eGRattletrapSoundsLike')}
            />
          )}
          {part(
            'appearance',
            <MechFlavorStep
              field="appearance"
              label={mechCopy('appearance')}
              value={form.appearance}
              onChange={(appearance) => updateForm({ appearance })}
              placeholder={mechCopy('howItLooksPlatingPaint')}
              multiline
            />
          )}
        </div>
      )}
      {step === 'review' && (
        <MechReviewStep
          form={form}
          submitError={submitError}
          askSignIn={askSignIn}
          leftoverScrap={leftoverScrapSplit(form, budget.remaining)}
          capacity={capacity}
          namePart={part(
            'pattern',
            <MechFlavorStep
              field="patternName"
              label={mechCopy('mechName')}
              value={form.name}
              onChange={setMechName}
              placeholder={mechCopy('eGBullseyePatternMule')}
            />
          )}
        />
      )}
    </WizShell>
  )
}
