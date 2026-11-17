import { MechSchema } from 'game-domain/schemas/mech'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { bookQuote, nameToSlug } from 'salvageunion-reference'
import { computeMechCapacity, MECH_CREATION_SCRAP_CAP } from 'salvageunion-reference/rules'
import { Tab, TabList, TabPanel, Tabs, toast, tokens } from '../../components/index'
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
import { mechCopy } from '../../messages/build-mech'
import { routesCopy } from '../../messages/routes'
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

/**
 * MOCK (Working Manual, mockup C): nine book steps become four, each one a
 * decision. "Gain Scrap" is step 1's cited rule; "Note down your Statistics"
 * is the picked chassis's detail; Systems and Modules share a step; Quirk and
 * Appearance share one; the name sits over the review. The book's own steps
 * (pp.94–95) stay in the rule briefs.
 */
type MockMechStep = 'chassis' | 'loadout' | 'look' | 'review'

const STEPS: readonly MockMechStep[] = ['chassis', 'loadout', 'look', 'review']

/** Stepper-rail labels (also the Next button's: it names the step it opens). */
const STEP_LABELS: Record<MockMechStep, string> = {
  chassis: 'Chassis',
  loadout: 'Systems & modules',
  look: 'Quirk & look',
  review: 'Name & review',
}

/** Step headings. */
const STEP_TITLES: Record<MockMechStep, string> = {
  chassis: 'Choose a chassis',
  loadout: 'Craft your Systems and Modules',
  look: 'Give it a Quirk and a look',
  review: 'Name your Mech and review',
}

/** MOCK: a merged step's parts, each under its own rule. */
const PARTS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
} satisfies CSSProperties

/** MOCK: the Systems | Modules tab row over its list. */
const LOADOUT_TABS = { marginBottom: tokens.space[16] } satisfies CSSProperties

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
    // MOCK: the merged steps answer to the book steps' own gates.
    gateFor: (s) =>
      s === 'chassis'
        ? mechCreationStepGate('chassis', form)
        : s === 'review'
          ? mechCreationStepGate('review', form)
          : mechCreationStepGate('systems', form),
    initialStep: 'chassis',
    submitStep: 'review',
    form,
    draftKey,
    formDirty,
    schema: MechSchema,
    toCreateInput: mechFormToCreateInput,
    failureMessage: mechCopy('theMechCouldNotBe'),
    onComplete,
    onCancel,
    onOffRules,
    gameId,
  })

  // MOCK: which list step 2 shows.
  const [loadoutTab, setLoadoutTab] = useState<'systems' | 'modules'>('systems')

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
      toast.info(mechCopy('chassisChangedItsScrapRefunded'))
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

  /** Step 8 names the mech, and so its pattern; the book pattern it started from stays as provenance. */
  function setMechName(value: string) {
    updateForm({ name: value })
  }

  // Per-step RuleBrief: the Core Book's own Mech Workshop copy, pp.94–95,
  // each quote a `bookQuote` so the rules-fidelity lock holds it to the book.
  // MOCK: kept by book step; a merged step shows each of its parts' rules.
  type BookStep =
    | 'scrap'
    | 'chassis'
    | 'stats'
    | 'systems'
    | 'modules'
    | 'quirk'
    | 'appearance'
    | 'pattern'
    | 'review'
  const ruleFor = (bookStep: BookStep): StepRule => {
    switch (bookStep) {
      case 'scrap':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 94 },
            'You start with 20 Tech 1 Scrap. You will use this Scrap to craft your first Mech. This is built out of a Tech 1 Mech Chassis and any number of Tech 1 Systems and Modules installed on the Mech Chassis. Any spare Scrap you have after this can be stored in your Union Crawler and be used later on in the game.'
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 94,
            see: [{ label: mechCopy('theUnionCrawler'), page: 212 }],
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
            see: [{ label: mechCopy('mechChassis'), page: [100, 159] }],
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
            see: [{ label: mechCopy('mechStatistics'), page: 96 }],
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
            source: 'Salvage Union Workshop Manual',
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
            source: 'Salvage Union Workshop Manual',
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
            source: 'Salvage Union Workshop Manual',
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
            source: 'Salvage Union Workshop Manual',
            page: 94,
            see: [{ label: mechCopy('patternNameTable'), page: 209 }],
          },
        }
      case 'review':
        return {
          rule: 'Check the build, then create your Mech. Whatever Scrap you did not spend banks to your Union Crawler.',
          cite: { source: 'Salvage Union Workshop Manual', page: [94, 95] },
        }
    }
  }
  const brief = (bookStep: BookStep) => {
    const { rule, cite } = ruleFor(bookStep)
    return <RuleBrief rule={rule} cite={cite} className="su-wiz-rule-brief" fold />
  }

  // Tracker tabs in the action pill: the SCRAP tab debuts on step 1 and rides
  // along wherever scrap can move; the slot pip chips join on their own
  // crafting steps.
  const trackers = (() => {
    const scrap = (
      <WizTracker
        label={mechCopy('scrap')}
        value={budget.remaining}
        max={MECH_CREATION_SCRAP_CAP}
        testId="scrap-remaining"
      />
    )
    // MOCK: one bar budget. Scrap rides every step that can spend it; the slot
    // counts join it on step 2 from sm, and are the tabs' own counts on a phone.
    switch (step) {
      case 'loadout':
        return (
          <>
            {scrap}
            <span className="su-wiz-pill-wide">
              <WizTracker
                label={mechCopy('systemSlots')}
                value={capacity.systemSlotsUsed}
                max={capacity.systemSlotsMax}
                testId="system-slot-count"
              />
            </span>
            <span className="su-wiz-pill-wide">
              <WizTracker
                label={mechCopy('moduleSlots')}
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

  // Systems/modules are OPTIONAL — say so where a player might
  // expect a block; otherwise surface the gate reason on a locked Next.
  // MOCK: the bar carries no note. A locked Next's reason shows on the step.
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
      submitLabel={mechCopy('createMech')}
    >
      {step === 'chassis' && (
        <>
          {/* MOCK: the read-only "Gain Scrap" step, as step 1's cited rule. */}
          {brief('scrap')}
          <MechChassisStep
            chassisName={form.chassisName}
            patternName={form.patternName}
            onSelectChassis={selectChassis}
            onSelectPattern={selectPattern}
            onSelectCustom={selectCustom}
          />
        </>
      )}
      {step === 'loadout' && (
        <Tabs value={loadoutTab} onValueChange={setLoadoutTab}>
          <TabList label="Systems and modules" style={LOADOUT_TABS}>
            <Tab value="systems">
              Systems · {capacity.systemSlotsUsed}/{capacity.systemSlotsMax} slots
            </Tab>
            <Tab value="modules">
              Modules · {capacity.moduleSlotsUsed}/{capacity.moduleSlotsMax} slots
            </Tab>
          </TabList>
          <TabPanel value="systems">
            {brief('systems')}
            <CraftItemsStep
              kind="systems"
              selected={form.systems}
              onCountChange={(name, next) => setInstallCount('systems', name, next)}
              scrapRemaining={budget.remaining}
              slotsRemaining={systemSlotsRemaining}
            />
          </TabPanel>
          <TabPanel value="modules">
            {brief('modules')}
            <CraftItemsStep
              kind="modules"
              selected={form.modules}
              onCountChange={(name, next) => setInstallCount('modules', name, next)}
              scrapRemaining={budget.remaining}
              slotsRemaining={moduleSlotsRemaining}
            />
          </TabPanel>
        </Tabs>
      )}
      {step === 'look' && (
        <div style={PARTS}>
          <div>
            {brief('quirk')}
            <MechFlavorStep
              field="quirk"
              label={mechCopy('quirk')}
              value={form.quirk}
              onChange={(quirk) => updateForm({ quirk })}
              placeholder={mechCopy('eGRattletrapSoundsLike')}
            />
          </div>
          <div>
            {brief('appearance')}
            <MechFlavorStep
              field="appearance"
              label={mechCopy('appearance')}
              value={form.appearance}
              onChange={(appearance) => updateForm({ appearance })}
              placeholder={mechCopy('howItLooksPlatingPaint')}
              multiline
            />
          </div>
        </div>
      )}
      {step === 'review' && (
        <div style={PARTS}>
          <div>
            {brief('pattern')}
            <MechFlavorStep
              field="patternName"
              label={mechCopy('namePattern')}
              value={form.name}
              onChange={setMechName}
              placeholder={mechCopy('eGBullseyePatternMule')}
              note={mechCopy('aMechsNameIsIts')}
            />
          </div>
          <MechReviewStep
            form={form}
            submitError={submitError}
            bankedScrap={Math.max(0, budget.remaining)}
          />
        </div>
      )}
    </WizShell>
  )
}
