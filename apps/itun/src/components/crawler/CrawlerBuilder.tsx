import { toast } from 'component-lib'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  SURefCrawler,
  SURefEntity,
  SURefMetaCrawlerTechLevel,
  SURefSystem,
} from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  crawlerMaxSP,
  isLegalCreationCrawlerWeapon,
  isWeaponSystem,
  resolveSystemRef,
} from 'salvageunion-reference/rules'
import { useMechs, usePilots } from '../../hooks/entities'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import type { CrawlerWizardStepId } from '../../lib/rules/creation'
import {
  clampCrawlerCreationDraft,
  crawlerCreationStepGate,
  crawlerWeaponSlotsFor,
} from '../../lib/rules/creation'
import { CrawlerSchema } from '../../lib/schemas/crawler'
import type { CrawlerWizardFormState } from '../../lib/wizard/crawlerFormState'
import {
  crawlerFormToCreateInput,
  EMPTY_CRAWLER_FORM_STATE,
  seedDefaultCrawlerBays,
} from '../../lib/wizard/crawlerFormState'
import { readWizardDraft, useWizardDraftSync, wizardDraftKey } from '../../lib/wizard/wizardDraft'
import { CrawlerStatsStep } from '../wizard/CrawlerStatsStep'
import { CrawlerTypeSelectStep } from '../wizard/CrawlerTypeStep'
import type { StepRule } from '../wizard/RuleBrief'
import { RuleBrief } from '../wizard/RuleBrief'
import { SystemsList } from '../wizard/SystemsList'
import { useWizardFlow } from '../wizard/useWizardFlow'
import { WizShell, WizTracker } from '../wizard/WizShell'
import { CrawlerCrewStep } from './CrawlerCrewStep'
import { CrawlerIdentityStep } from './CrawlerIdentityStep'
import { CrawlerReviewStep } from './CrawlerReviewStep'

/** Book-order steps (Union Crawler pp.212–213 + Review — plan §4.3). */
const STEPS: readonly CrawlerWizardStepId[] = [
  'type',
  'stats',
  'weapons',
  'crew',
  'identity',
  'review',
]

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
  /** Called on successful create with the crawler's id. */
  onComplete: (crawlerId: string) => void
  /** Called when the user cancels. */
  onCancel: () => void
  /** Leaves the guided flow for the blank Free-Edit path (P3.3). */
  onOffRules?: () => void
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
 *   - there is no warnings Banner — nothing can be in violation.
 */
export function CrawlerBuilder({ onComplete, onCancel, onOffRules }: CrawlerBuilderProps) {
  // Read straight from the ORM: this renders inside GameDataReady, whose
  // preload('all') has already resolved, so these are synchronous. crawlers
  // drives the type selection (and its mutations-derived budgets);
  // crawler-bays seeds the default bays + the Crew step; crawler-tech-levels
  // backs the Statistics step + the SP derivation. No per-component preload:
  // it is redundant behind the gate and costs an empty first render.
  const techLevels = useMemo<SURefMetaCrawlerTechLevel[]>(
    () =>
      [...SalvageUnionReference.CrawlerTechLevels.all()].sort((a, b) => a.techLevel - b.techLevel),
    []
  )
  const allSystems = useMemo<SURefSystem[]>(() => SalvageUnionReference.Systems.all(), [])
  const allBays = useMemo<SURefEntity[]>(() => SalvageUnionReference.CrawlerBays.all(), [])
  const types = useMemo<SURefCrawler[]>(() => SalvageUnionReference.Crawlers.all(), [])

  // Advisory prelude context (plan §4.3 step 0): a gentle count of the pilots
  // and mechs saved here — surfaced in step 1's RuleBrief, NEVER a blocker
  // (the whole table's state can't be verified).
  const pilotCount = usePilots().length
  const mechCount = useMechs().length

  // Draft-aware init: a stored session draft (refresh, back-nav, PWA reload)
  // wins over the empty state; cleared on submit/cancelled exit. Drafts pass
  // through the deterministic clamp (§5.3): illegal types/weapons drop, then
  // weapons clamp NEWEST-first to the type's slots; removals are announced
  // once, by toast.
  const draftKey = wizardDraftKey('crawler')
  const clampRemovedRef = useRef<string[] | null>(null)
  const [form, setForm] = useState<CrawlerWizardFormState>(() => {
    const draft = readWizardDraft<CrawlerWizardFormState>(draftKey)
    if (!draft) return EMPTY_CRAWLER_FORM_STATE
    const { form: clamped, removed } = clampCrawlerCreationDraft(draft)
    if (removed.length > 0) clampRemovedRef.current = removed
    return clamped
  })
  useEffect(() => {
    const removed = clampRemovedRef.current
    if (removed && removed.length > 0) {
      clampRemovedRef.current = null
      toast.info(`Draft trimmed to the starting rules — removed ${removed.join(', ')}.`)
    }
  }, [])
  const formDirty = useWizardDraftSync(draftKey, form, EMPTY_CRAWLER_FORM_STATE)

  // The step machine + the create submit, shared with the pilot and mech
  // wizards (`useWizardFlow`). `toCreateInput` is a closure rather than the
  // bare projection: a fresh crawler starts at its DERIVED full SP and
  // pre-seeds the base bay set. The failure copy is passed verbatim: the
  // crawler's carries no "Please retry." suffix.
  const { step, gate, submitError, shell } = useWizardFlow({
    entityType: 'crawler',
    noun: 'crawler',
    steps: STEPS,
    stepLabels: STEP_LABELS,
    gateFor: (s) => crawlerCreationStepGate(s, form),
    initialStep: 'type',
    submitStep: 'review',
    form,
    draftKey,
    formDirty,
    schema: CrawlerSchema,
    toCreateInput: (f) => {
      // Fresh crawlers start at FULL SP — the DERIVED max (bare tech-level
      // base + the type's read-applied bonus; Battle = 20 + 5 = 25). The
      // record itself stores no SP maximum: maxSP stays derived-at-read.
      const maxSP =
        f.techLevel !== null
          ? crawlerMaxSP({
              techLevel: `tech-${f.techLevel}`,
              ...(f.type !== null ? { type: f.type } : {}),
            })
          : undefined
      // Seed the full base bay set — the official sheets pre-print every bay.
      return crawlerFormToCreateInput(f, { maxSP, crawlerBays: seedDefaultCrawlerBays() })
    },
    failureMessage: 'Failed to save crawler.',
    onComplete,
    onCancel,
    onOffRules,
  })

  function updateForm(patch: Partial<CrawlerWizardFormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function weaponName(ref: string): string {
    return resolveSystemRef(ref)?.name ?? ref
  }

  /**
   * Choose a crawler type (radio). The type's mutations re-derive the
   * downstream budgets, so switching RE-CLAMPS step 3's weapons to the new
   * Armament-Bay cap (newest dropped first) — never a silent mutation, the
   * toast names what was removed (§5.3). Switching away from a
   * previously-chosen type also drops that old type's crew entry (keyed by the
   * old type's slug) so it can never persist as a phantom bay / stale type NPC
   * on save.
   */
  function selectType(typeSlug: string) {
    if (form.type === typeSlug) return
    const nextCrew = { ...form.crew }
    if (form.type !== null) delete nextCrew[form.type]

    let nextSystems = form.systems
    const slots = crawlerWeaponSlotsFor(typeSlug)
    if (form.systems.length > slots) {
      const dropped = form.systems.slice(slots).map(weaponName)
      nextSystems = form.systems.slice(0, slots)
      toast.info(
        `Type changed — this type mounts ${slots} Weapons System${slots === 1 ? '' : 's'}; removed ${dropped.join(', ')}.`
      )
    }
    updateForm({ type: typeSlug, crew: nextCrew, systems: nextSystems })
  }

  const selectedTechLevel = techLevels.find((t) => t.techLevel === form.techLevel)
  const selectedType = form.type ? (resolveCrawlerType(form.type) ?? undefined) : undefined
  // Bays with an embedded crew NPC (the 10 base bays) — the Crew step's roster.
  const crewBays = allBays.filter((b) => (b as { npc?: unknown }).npc != null)
  // The auto-seeded base set (expansion-tagged bays never appear — a STORED
  // data flag, never computed).
  const baseBayCount = allBays.filter((b) => !(b as { expansion?: boolean }).expansion).length

  /**
   * The Armament-Bay catalog: WEAPONS systems only (the bay holds nothing
   * else — Core Book p.213), HARD-filtered to Tech 1
   * (`isLegalCreationCrawlerWeapon`). Systems with non-numeric TL
   * (Bio/Nanite) are never Tech 1.
   */
  const weaponCatalog = useMemo(
    () => allSystems.filter((s) => isWeaponSystem(s) && isLegalCreationCrawlerWeapon(s.techLevel)),
    [allSystems]
  )

  const chosenSystems = form.systems
    .map(resolveSystemRef)
    .filter((s): s is SURefSystem & { schemaName: string } => s !== null)

  // The Armament-Bay cap comes from the type's STORED `mutations` rows
  // (weapon_slots; Battle = 2) — plan §4.3. Selection clamps at this.
  const weaponSlots = crawlerWeaponSlotsFor(form.type)
  const installedWeaponCount = form.systems.filter((slug) => {
    const system = resolveSystemRef(slug)
    return system ? isWeaponSystem(system) : false
  }).length

  // Per-step RuleBrief: the Core Book's own Union Crawler copy, pp.212–213.
  const stepRule: StepRule = (() => {
    switch (step) {
      case 'type':
        return {
          rule: (
            <>
              Once all players have created their Pilot and Mech, the final step is for everyone to
              create the Union Crawler they share. Your Crawler type provides a unique Ability that
              only it can do, as well as a special NPC who resides on the Crawler and confers their
              own bonuses.{' '}
              <span className="text-wk-muted">
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
        return {
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
          rule: 'Check the build, then create your Crawler.',
          cite: 'Core Book · pp.212–213',
        }
    }
  })()

  // Tracker tab in the action pill: the WEAPONS pip chip rides on the
  // Armament step (mockup Screen 03).
  const trackers =
    step === 'weapons' ? (
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
      eyebrow="Union Crawler"
      {...shell}
      title={STEP_TITLES[step]}
      trackers={trackers}
      footerNote={footerNote}
      submitLabel="Create Crawler ✦"
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
          maxSelectable={weaponSlots}
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
