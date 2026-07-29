import { useEffect, useMemo, useRef, useState } from 'react'

import { SalvageUnionReference } from 'salvageunion-reference'
import type {
  SURefCrawler,
  SURefEntity,
  SURefMetaCrawlerTechLevel,
  SURefSystem,
} from 'salvageunion-reference'
import { isLegalCreationCrawlerWeapon, isWeaponSystem } from 'salvageunion-reference/rules'
import { toast } from 'component-lib'

import { useMechs, usePilots } from '../../hooks/queries'
import { computeCrawlerCapacity } from '../../lib/rules/crawlerCapacity'
import {
  clampCrawlerCreationDraft,
  crawlerCreationStepGate,
  crawlerWeaponSlotsFor,
} from '../../lib/rules/creation'
import type { CrawlerWizardStepId, StepGateResult } from '../../lib/rules/creation'
import { crawlerMaxSP } from '../../lib/rules/derivedStats'
import type { SoftWarning } from '../../lib/rules/types'
import { CrawlerSchema } from '../../lib/schemas/crawler'
import { applyCrawlerCrewAndTypeEdit } from '../../lib/wizard/applyCrawlerEdit'
import {
  EMPTY_CRAWLER_FORM_STATE,
  crawlerFormToCreateInput,
  crawlerFormToUpdatePatch,
  seedDefaultCrawlerBays,
} from '../../lib/wizard/crawlerFormState'
import type { CrawlerWizardFormState } from '../../lib/wizard/crawlerFormState'
import {
  clearWizardDraft,
  readWizardDraft,
  useWizardDraftSync,
  wizardDraftKey,
} from '../../lib/wizard/wizardDraft'
import { useEntityStore } from '../../stores/entityStore'
import { Banner } from 'component-lib'
import { OffRulesEscape } from 'component-lib'
import { RuleBrief } from 'component-lib'
import type { StepRule } from 'component-lib'
import { WizShell, WizTracker } from 'component-lib'
import { CrawlerCrewStep } from './CrawlerCrewStep'
import { CrawlerIdentityStep } from './CrawlerIdentityStep'
import { CrawlerReviewStep } from './CrawlerReviewStep'
import { CrawlerStatsStep } from 'component-lib'
import { CrawlerTypeSelectStep } from 'component-lib'
import { SystemsList } from 'component-lib'
import { WIZARD_TXN } from '../../stores/surfaceProvenance'

/**
 * Book-order steps (Union Crawler pp.212–213 + Review — plan §4.3). Edit mode
 * (§5.2) hides the display-only Statistics step and keeps the rest
 * (1, 3, 4, 5, Review).
 */
const CREATE_STEPS: readonly CrawlerWizardStepId[] = [
  'type',
  'stats',
  'weapons',
  'crew',
  'identity',
  'review',
]
const EDIT_STEPS: readonly CrawlerWizardStepId[] = CREATE_STEPS.filter((s) => s !== 'stats')

/** Stepper-rail labels (mockup Screen 03 `.rlabel`). */
const STEP_LABELS: Record<CrawlerWizardStepId, string> = {
  type: 'Crawler Type',
  stats: 'Statistics',
  weapons: 'Armament Bay',
  crew: 'Crew',
  identity: 'Name',
  review: 'Review',
}

/** Step headings — the book's own step names (pp.212–213). */
const STEP_TITLES: Record<CrawlerWizardStepId, string> = {
  type: 'Choose a Crawler Type',
  stats: 'Note your Crawler Statistics',
  weapons: 'Arm the Armament Bay',
  crew: 'Name your Crew',
  identity: 'Name your Crawler',
  review: 'Review',
}

type CrawlerBuilderProps = {
  /** Called on successful create/save with the crawler's id. */
  onComplete: (crawlerId: string) => void
  /** Called when the user cancels. */
  onCancel: () => void
  /** Leaves the guided flow for the blank Free-Edit path (P3.3). Create only. */
  onOffRules?: () => void
  /**
   * Id of an existing crawler being edited. When provided, handleSubmit takes
   * the update branch (never duplicates), the hard creation gates relax to
   * presence checks, budgets lift (no weapon cap), and the TL filter lifts
   * (all tech levels — plan §5.2).
   */
  crawlerId?: string
  /**
   * Initial form state — pass `crawlerToFormState(crawler)` in edit mode.
   * Defaults to the empty creation state.
   */
  initialState?: CrawlerWizardFormState
}

/** Edit-mode gates: presence checks only (plan §5.2 — soft regime). */
function crawlerEditStepGate(
  step: CrawlerWizardStepId,
  form: CrawlerWizardFormState
): StepGateResult {
  const hasName = form.name.trim() !== ''
  switch (step) {
    // Editing a legacy (untyped) crawler can advance without a type — the
    // type stays absent and the stored TL is preserved.
    case 'identity':
    case 'review':
      return hasName ? { ok: true } : { ok: false, reason: 'Name your Crawler to continue' }
    default:
      return { ok: true }
  }
}

/** Slot pips for the tracker tab: ●○ (capped so the tab stays a tab). */
function slotPips(used: number, max: number): string {
  if (max <= 0 || max > 12) return ''
  const filled = Math.max(0, Math.min(used, max))
  return `${'●'.repeat(filled)}${'○'.repeat(max - filled)} `
}

/**
 * Multi-step crawler wizard on the shared WizShell skeleton, restructured to
 * the Union Crawler's 5 book steps + Review (wizard-refresh Phase 5, plan
 * §4.3, mockup Screen 03 — magenta band, peach step card) with the crawler
 * creation rules enforced HARD (§5):
 *
 *   - exactly 1 of 5 types (radio, entity cards); the type's stored
 *     `mutations` drive the Armament-Bay cap AND the Max SP bonus (never an
 *     action-name string match); changing type re-clamps step 3 with a toast;
 *   - Tech Level is FIXED at 1 (display-only Statistics step, no input);
 *     Max SP stores the BARE tech-level value — the type's +5 applies at
 *     READ (crawlerMaxSP), so type swaps re-derive correctly both ways;
 *   - only Tech 1 WEAPONS systems are offered; MINIMUM 1 to advance; the cap
 *     is clamped at selection time (Battle = 2);
 *   - the 10 base bays auto-seed (never choosable); expansion bays never
 *     appear; NPC HP is fixed by data; crew flavor is optional;
 *   - the name is required; `upgradePool` is fixed at 0 (input removed);
 *     `scrapPool` is an explicit optional input relocated to step 5;
 *   - Banner is REMOVED from the create flow — nothing can be in
 *     violation. Edit mode keeps the soft regime (§5.2): Statistics hidden,
 *     budgets undefined, TL filter lifted, gates relaxed to presence checks,
 *     advisory warnings remain.
 */
export function CrawlerBuilder({
  onComplete,
  onCancel,
  onOffRules,
  crawlerId,
  initialState,
}: CrawlerBuilderProps) {
  const isEdit = crawlerId !== undefined
  const steps = isEdit ? EDIT_STEPS : CREATE_STEPS

  const [techLevels, setTechLevels] = useState<SURefMetaCrawlerTechLevel[]>([])
  const [allSystems, setAllSystems] = useState<SURefSystem[]>([])
  const [allBays, setAllBays] = useState<SURefEntity[]>([])
  const [types, setTypes] = useState<SURefCrawler[]>([])

  // Advisory prelude context (plan §4.3 step 0): a gentle count of the pilots
  // and mechs saved here — surfaced in step 1's RuleBrief, NEVER a blocker
  // (the whole table's state can't be verified).
  const pilotCount = usePilots().length
  const mechCount = useMechs().length

  // Draft-aware init: a stored session draft (refresh, back-nav, PWA reload)
  // wins over the pristine initial state; cleared on submit/cancelled exit.
  // Create-mode drafts pass through the deterministic clamp (§5.3): illegal
  // types/weapons drop, then weapons clamp NEWEST-first to the type's slots;
  // removals are announced once, by toast.
  const draftKey = wizardDraftKey('crawler', crawlerId)
  const clampRemovedRef = useRef<string[] | null>(null)
  const [form, setForm] = useState<CrawlerWizardFormState>(() => {
    const draft = readWizardDraft<CrawlerWizardFormState>(draftKey)
    if (draft && !isEdit) {
      const { form: clamped, removed } = clampCrawlerCreationDraft(draft)
      if (removed.length > 0) clampRemovedRef.current = removed
      return clamped
    }
    return draft ?? initialState ?? EMPTY_CRAWLER_FORM_STATE
  })
  useEffect(() => {
    const removed = clampRemovedRef.current
    if (removed && removed.length > 0) {
      clampRemovedRef.current = null
      toast.info(`Draft trimmed to the starting rules — removed ${removed.join(', ')}.`)
    }
  }, [])
  const formDirty = useWizardDraftSync(draftKey, form, initialState ?? EMPTY_CRAWLER_FORM_STATE)
  const [step, setStep] = useState<CrawlerWizardStepId>(steps[0] ?? 'type')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const currentIndex = steps.indexOf(step)

  useEffect(() => {
    // crawlers drives the type selection (and its mutations-derived budgets);
    // crawler-bays seeds the default bays + the Crew step; crawler-tech-levels
    // backs the Statistics step + the SP derivation; actions resolves each
    // system's damage so isWeaponSystem can filter to weapons; roll-tables
    // backs the Crawler Name d20 assist. The route loader preloads the same
    // set, so this resolves instantly on the normal path.
    void SalvageUnionReference.preload([
      'crawlers',
      'crawler-tech-levels',
      'systems',
      'crawler-bays',
      'actions',
      'roll-tables',
    ]).then(() => {
      const tls = SalvageUnionReference.CrawlerTechLevels.all()
      setTechLevels([...tls].sort((a, b) => a.techLevel - b.techLevel))
      setAllSystems(SalvageUnionReference.Systems.all())
      setAllBays(SalvageUnionReference.CrawlerBays.all())
      setTypes(SalvageUnionReference.Crawlers.all())
    })
  }, [])

  function updateForm(patch: Partial<CrawlerWizardFormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function weaponName(ref: string): string {
    return allSystems.find((s) => s.id === ref)?.name ?? ref
  }

  /**
   * Choose a crawler type (radio). The type's mutations re-derive the
   * downstream budgets, so switching in create mode RE-CLAMPS step 3's
   * weapons to the new Armament-Bay cap (newest dropped first) — never a
   * silent mutation, the toast names what was removed (§5.3). Switching away
   * from a previously-chosen type also drops that old type's crew entry
   * (keyed by the old type id) so it can never persist as a phantom bay /
   * stale type NPC on save.
   */
  function selectType(typeId: string) {
    if (form.type === typeId) return
    const nextCrew = { ...form.crew }
    if (form.type !== null) delete nextCrew[form.type]

    let nextSystems = form.systems
    if (!isEdit) {
      const slots = crawlerWeaponSlotsFor(typeId)
      if (form.systems.length > slots) {
        const dropped = form.systems.slice(slots).map(weaponName)
        nextSystems = form.systems.slice(0, slots)
        toast.info(
          `Type changed — this type mounts ${slots} Weapons System${slots === 1 ? '' : 's'}; removed ${dropped.join(', ')}.`
        )
      }
    }
    updateForm({ type: typeId, crew: nextCrew, systems: nextSystems })
  }

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
    if (currentIndex > 0 && prev) setStep(prev)
  }

  async function handleSubmit() {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const store = useEntityStore.getState()

      // Upsert branch: update when editing — NEVER a second create.
      // The patch touches only wizard-owned fields; bays/NPC live state stays.
      if (crawlerId) {
        // Read the stored record BEFORE the wizard patch so we know the old
        // type (the patch overwrites `type`).
        const stored = store.get('crawler', crawlerId)
        const oldType = stored?.type ?? null

        await store.update('crawler', crawlerId, crawlerFormToUpdatePatch(form), WIZARD_TXN)

        // Crew/NPC edits + the type-NPC reset / orphan cleanup route through the
        // shared multi-write helper (also used by the live sheet's inline build
        // editor), so live HP/condition on bays + the type NPC survive an edit.
        await applyCrawlerCrewAndTypeEdit(store, crawlerId, form, oldType, types)

        toast.success(`Saved ${form.name.trim() || 'crawler'}.`)
        clearWizardDraft(draftKey)
        onComplete(crawlerId)
        return
      }

      const now = new Date().toISOString()
      // Fresh crawlers start at FULL SP — the DERIVED max (bare tech-level
      // base + the type's read-applied bonus; Battle = 20 + 5 = 25). The
      // record itself stores no SP maximum: maxSP stays derived-at-read.
      const maxSP =
        form.techLevel !== null
          ? crawlerMaxSP({
              techLevel: `tech-${form.techLevel}`,
              ...(form.type !== null ? { type: form.type } : {}),
            })
          : undefined
      // Seed the full base bay set — the official sheets pre-print every bay.
      const rawInput = crawlerFormToCreateInput(form, {
        maxSP,
        crawlerBays: seedDefaultCrawlerBays(),
      })

      // Validate against CrawlerSchema before submitting (surface errors in-UI)
      const validation = CrawlerSchema.safeParse({
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

      const created = await store.create('crawler', rawInput)
      toast.success(`Saved ${form.name.trim() || 'crawler'}.`)
      clearWizardDraft(draftKey)
      onComplete(created.id)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save crawler.')
      setIsSubmitting(false)
    }
  }

  const selectedTechLevel = techLevels.find((t) => t.techLevel === form.techLevel)
  const selectedType = types.find((t) => t.id === form.type || t.name === form.type)
  // Bays with an embedded crew NPC (the 10 base bays) — the Crew step's roster.
  const crewBays = allBays.filter((b) => (b as { npc?: unknown }).npc != null)
  // The auto-seeded base set (expansion-tagged bays never appear — a STORED
  // data flag, never computed).
  const baseBayCount = allBays.filter((b) => !(b as { expansion?: boolean }).expansion).length

  /**
   * The Armament-Bay catalog: WEAPONS systems only (the bay holds nothing
   * else — Core Book p.213). Guided create is HARD-filtered to Tech 1
   * (`isLegalCreationCrawlerWeapon`); edit lifts the TL filter entirely
   * (plan §5.2). Systems with non-numeric TL (Bio/Nanite) are never Tech 1.
   */
  const weaponCatalog = useMemo(() => {
    const weapons = allSystems.filter((s) => isWeaponSystem(s))
    if (isEdit) return weapons
    return weapons.filter((s) => isLegalCreationCrawlerWeapon(s.techLevel))
  }, [allSystems, isEdit])

  const chosenSystems = form.systems
    .map((id) => allSystems.find((s) => s.id === id))
    .filter((s): s is SURefSystem => s !== undefined)

  // The Armament-Bay cap comes from the type's STORED `mutations` rows
  // (weapon_slots; Battle = 2) — plan §4.3, replacing the old action-name
  // string match. Create clamps at this; edit lifts the budget (§5.2).
  const weaponSlots = crawlerWeaponSlotsFor(form.type)
  const installedWeaponCount = form.systems.filter((id) => {
    const system = allSystems.find((s) => s.id === id)
    return system ? isWeaponSystem(system) : false
  }).length

  // Edit-mode advisory capacity warning (soft — never blocks; §5.2). The
  // create flow renders NO Banner: violations are impossible by
  // construction.
  const crawlerCapacity = useMemo(() => {
    const weaponSystems = form.systems.filter((id) => {
      const system = allSystems.find((s) => s.id === id)
      return system ? isWeaponSystem(system) : false
    })
    return computeCrawlerCapacity({
      techLevel: form.techLevel ?? 0,
      bays: [],
      weaponSystems,
      isBattleCrawler: weaponSlots > 1,
    })
  }, [form.techLevel, form.systems, allSystems, weaponSlots])
  const isOverCapacity = crawlerCapacity.violations.some(
    (v) => v.kind === 'weapon-systems-over-capacity'
  )

  const capacityWarnings: SoftWarning[] = isOverCapacity
    ? [
        {
          code: 'weapon-systems-over-capacity',
          severity: 'warn',
          message: `Over capacity — ${crawlerCapacity.weaponSystemsUsed} weapon systems installed, ${crawlerCapacity.weaponSystemsMax} supported for this crawler type. You can still save; review before play.`,
        },
      ]
    : []
  const capacityNotice =
    isEdit && (step === 'weapons' || step === 'review') ? (
      <Banner warnings={capacityWarnings} />
    ) : undefined

  // Next-gating (§5.3): guided create runs the hard step gates; edit runs
  // presence checks. The gate's reason renders in the footerNote so a locked
  // Next always explains itself.
  const gate = isEdit ? crawlerEditStepGate(step, form) : crawlerCreationStepGate(step, form)

  // Per-step RuleBrief: the Core Book's own Union Crawler copy, pp.212–213
  // (create); edit variants describe the lifted soft regime.
  const stepRule: StepRule = (() => {
    switch (step) {
      case 'type':
        return isEdit
          ? {
              rule: 'Change your Crawler type — one of five. Changing it resets the special NPC and re-derives the Armament-Bay cap and Max SP; over-cap weapons warn, never block.',
              cite: 'Core Book · pp.216–217',
            }
          : {
              rule: (
                <>
                  Once all players have created their Pilot and Mech, the final step is for everyone
                  to create the Union Crawler they share. Your Crawler type provides a unique
                  Ability that only it can do, as well as a special NPC who resides on the Crawler
                  and confers their own bonuses.{' '}
                  <span className="text-ink-2">
                    (You have {pilotCount} Pilot{pilotCount === 1 ? '' : 's'} and {mechCount} Mech
                    {mechCount === 1 ? '' : 's'} saved so far — context only, never a blocker.)
                  </span>
                </>
              ),
              cite: 'Core Book · p.212 · Crawler types pp.216–217',
            }
      case 'stats':
        return {
          rule: 'Your Crawler has a set of statistics based on its Tech Level. This includes its Structure Points, Upkeep, and Upgrade cost. Note these down on your Crawler Sheet.',
          cite: 'Core Book · p.212 · Crawler Stats p.218',
        }
      case 'weapons':
        return isEdit
          ? {
              rule: 'Mount Weapons Systems in the Armament Bay — any tech level. Over-capacity warns on the sheet, never blocks.',
              cite: 'Core Book · p.213',
            }
          : {
              rule: 'A Union Crawler can mount a single Weapons System in its Armament Bay. To start, this can be any Tech 1 Weapons System of the players’ choice — a Battle Crawler mounts two. Note this down on your Crawler Sheet.',
              cite: 'Core Book · p.213 · The System list p.162',
            }
      case 'crew':
        return {
          rule: 'The Crawler is made of a number of Bays. Each Bay has an NPC assigned to it based on their experience and skill in operating the Bay. You can flesh them out with a Name, Background, Keepsake, and Motto. Each has 4 HP.',
          cite: 'Core Book · p.213 · The Crawler Bay list p.221',
        }
      case 'identity':
        return {
          rule: 'Provide your Union Crawler with a unique name and tag. For example, Crawler #132 is also known as ‘Tin Lizzy’. Note these down on your Crawler Sheet. The Scrap Pool below holds the group’s banked Scrap — including whatever your Pilots didn’t spend crafting their Mechs.',
          cite: 'Core Book · p.212 · The Crawler Names Table p.226',
        }
      case 'review':
        return {
          rule: isEdit
            ? 'Check the changes, then save.'
            : 'Check the build, then create your Crawler.',
          cite: isEdit ? undefined : 'Core Book · pp.212–213',
        }
    }
  })()

  // Tracker tab in the action pill (create only — edit lifts the budgets):
  // the WEAPONS pip chip rides on the Armament step (mockup Screen 03).
  const trackers =
    !isEdit && step === 'weapons' ? (
      <WizTracker
        label="Weapons"
        value={
          <span data-testid="weapon-system-count">
            {slotPips(installedWeaponCount, weaponSlots)}
            {installedWeaponCount} / {weaponSlots}
          </span>
        }
      />
    ) : undefined

  const footerNote = !gate.ok ? gate.reason : undefined

  return (
    <WizShell
      kind="crawler"
      eyebrow={isEdit ? 'Edit Crawler' : 'Union Crawler'}
      steps={steps.map((s) => STEP_LABELS[s])}
      active={currentIndex}
      onStepClick={(i) => {
        const s = steps[i]
        if (s) setStep(s)
      }}
      title={STEP_TITLES[step]}
      tintedStepCard
      notice={capacityNotice}
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
      submitLabel={isEdit ? 'Save Crawler' : 'Create Crawler ✦'}
    >
      <RuleBrief rule={stepRule.rule} cite={stepRule.cite} className="mb-5" />
      {step === 'type' && (
        <CrawlerTypeSelectStep types={types} selectedType={form.type} onSelect={selectType} />
      )}
      {step === 'stats' && (
        <CrawlerStatsStep techLevel={selectedTechLevel} selectedType={selectedType} />
      )}
      {step === 'weapons' && (
        <SystemsList
          systems={weaponCatalog}
          selectedSystemSlugs={form.systems}
          maxSelectable={isEdit ? undefined : weaponSlots}
          installedWeaponCount={installedWeaponCount}
          onChange={(systems) => updateForm({ systems })}
        />
      )}
      {step === 'crew' && (
        <CrawlerCrewStep
          bays={crewBays}
          selectedType={selectedType}
          crew={form.crew}
          onChange={updateForm}
        />
      )}
      {step === 'identity' && (
        <CrawlerIdentityStep
          name={form.name}
          description={form.description}
          scrapPool={form.scrapPool}
          onChange={updateForm}
        />
      )}
      {step === 'review' && (
        <CrawlerReviewStep
          form={form}
          techLevel={selectedTechLevel}
          selectedType={selectedType}
          systems={chosenSystems}
          bayCount={baseBayCount}
          submitError={submitError}
        />
      )}
    </WizShell>
  )
}
