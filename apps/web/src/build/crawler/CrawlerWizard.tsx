import { CrawlerSchema } from 'game-domain/schemas/crawler'
import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'
import type {
  RefCrawler,
  RefEntity,
  RefMetaCrawlerTechLevel,
  RefSystem,
} from 'salvageunion-reference'
import { bookQuote, SalvageUnionReference } from 'salvageunion-reference'
import {
  crawlerMaxSP,
  isLegalCreationCrawlerWeapon,
  isWeaponSystem,
  resolveSystemRef,
} from 'salvageunion-reference/rules'
import { toast, tokens } from '../../components/index'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { useOwnUnits } from '../../lib/entities'
import type { CrawlerWizardStepId } from '../../lib/rules/creation'
import {
  clampCrawlerCreationDraft,
  crawlerCreationStepGate,
  crawlerWeaponSlotsFor,
} from '../../lib/rules/creation'
import type { CrawlerWizardFormState } from '../../lib/wizard/crawlerFormState'
import {
  crawlerFormToCreateInput,
  EMPTY_CRAWLER_FORM_STATE,
  seedDefaultCrawlerBays,
} from '../../lib/wizard/crawlerFormState'
import { withPreselection } from '../../lib/wizard/preselect'
import { crawlerCopy } from '../../messages/build-crawler'
import { routesCopy } from '../../messages/routes'
import { CrawlerStatsStep } from '../wizard/CrawlerStatsStep'
import { CrawlerTypeSelectStep } from '../wizard/CrawlerTypeStep'
import type { StepRule } from '../wizard/RuleBrief'
import { RuleBrief } from '../wizard/RuleBrief'
import { SystemsList } from '../wizard/SystemsList'
import { useWizardDraft } from '../wizard/useWizardDraft'
import { useWizardFlow } from '../wizard/useWizardFlow'
import { WizTracker } from '../wizard/WizBudget'
import { WizShell } from '../wizard/WizShell'
import { CrawlerCrewStep } from './CrawlerCrewStep'
import { CrawlerIdentityStep } from './CrawlerIdentityStep'
import { CrawlerReviewStep } from './CrawlerReviewStep'

/** The RuleBrief's muted aside (the saved pilot/mech count). */
const MUTED = { color: tokens.color.wkMuted } satisfies CSSProperties

/**
 * The wizard's four steps, each one a decision. The book's six (pp.212–213)
 * stay in the rule briefs: "Note your Crawler Statistics" asks nothing, so the
 * numbers stand under the type's picker; the crew and the crawler's name share
 * a step; the review is the build as its sheet will read.
 */
type CrawlerStep = 'type' | 'weapons' | 'crew' | 'review'

const STEPS: readonly CrawlerStep[] = ['type', 'weapons', 'crew', 'review']

/** Stepper-rail labels (also the Next button's: it names the step it opens). */
const STEP_LABELS: Record<CrawlerStep, string> = {
  type: crawlerCopy('crawlerType'),
  weapons: crawlerCopy('armamentBay'),
  crew: crawlerCopy('nameCrew'),
  review: crawlerCopy('review'),
}

/** Step headings. */
const STEP_TITLES: Record<CrawlerStep, string> = {
  type: crawlerCopy('chooseACrawlerType'),
  weapons: crawlerCopy('armTheArmamentBay'),
  crew: crawlerCopy('nameYourCrawlerAnd'),
  review: crawlerCopy('reviewYourCrawler'),
}

/** The book's steps a rule brief quotes (the review quotes none). */
type BookStep = Exclude<CrawlerWizardStepId, 'review'>

type CrawlerWizardProps = {
  /** Called on successful create with the crawler's id. */
  onComplete: (crawlerId: string) => void
  /** Called when the user cancels. */
  onCancel: () => void
  /** Leaves the guided flow for the blank Free-Edit path (P3.3). */
  onOffRules?: () => void
  /** The Game the new unit lands in (`?game=<id>`, ADR-052 §3); unset, the store decides. */
  gameId?: string | undefined
  /** A crawler-type slug to start on (`?type=`), already checked by `preselectedCrawlerType`. */
  preselectType?: string
}

/**
 * The crawler wizard on the shared WizShell: four steps over the Union
 * Crawler's book steps, with the crawler creation rules enforced HARD (§5):
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
export function CrawlerWizard({
  onComplete,
  onCancel,
  onOffRules,
  gameId,
  preselectType,
}: CrawlerWizardProps) {
  // Read straight from the ORM: this renders inside GameDataReady, whose
  // preload('all') has already resolved, so these are synchronous. crawlers
  // drives the type selection (and its mutations-derived budgets);
  // crawler-bays seeds the default bays + the Crew step; crawler-tech-levels
  // backs the Statistics step + the SP derivation. No per-component preload:
  // it is redundant behind the gate and costs an empty first render.
  const techLevels = useMemo<RefMetaCrawlerTechLevel[]>(
    () =>
      [...SalvageUnionReference.CrawlerTechLevels.all()].sort((a, b) => a.techLevel - b.techLevel),
    []
  )
  const allSystems = useMemo<RefSystem[]>(() => SalvageUnionReference.Systems.all(), [])
  const allBays = useMemo<RefEntity[]>(() => SalvageUnionReference.CrawlerBays.all(), [])
  const types = useMemo<RefCrawler[]>(() => SalvageUnionReference.Crawlers.all(), [])

  // How many pilots and mechs of yours are saved here, said beside step 1's
  // rule (the book makes the crawler last). It gates nothing.
  const pilotCount = useOwnUnits('pilot').length
  const mechCount = useOwnUnits('mech').length

  // The session draft (`useWizardDraft`): the deterministic clamp (§5.3)
  // drops illegal types/weapons, then clamps weapons NEWEST-first to the
  // type's slots, and a deep-linked `?type=` is the baseline.
  const baseline = useMemo(
    () => withPreselection(EMPTY_CRAWLER_FORM_STATE, 'type', preselectType),
    [preselectType]
  )
  const { form, setForm, formDirty, draftKey } = useWizardDraft<CrawlerWizardFormState>('crawler', {
    baseline,
    clamp: clampCrawlerCreationDraft,
    reapply: (restored) => withPreselection(restored, 'type', preselectType),
  })

  // The step machine + the create submit, shared with the pilot, mech and
  // NPC wizards (`useWizardFlow`). `toCreateInput` is a closure rather than the
  // bare projection: a fresh crawler starts at its DERIVED full SP and
  // pre-seeds the base bay set.
  const { step, gate, submitError, shell } = useWizardFlow({
    entityType: 'crawler',
    noun: 'crawler',
    steps: STEPS,
    stepLabels: STEP_LABELS,
    // The name-and-crew step answers to the book step that gates it (the name).
    gateFor: (s) => crawlerCreationStepGate(s === 'crew' ? 'identity' : s, form),
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
              techLevel: f.techLevel,
              ...(f.type !== null ? { type: f.type } : {}),
            })
          : undefined
      // Seed the full base bay set — the official sheets pre-print every bay.
      return crawlerFormToCreateInput(f, { maxSP, crawlerBays: seedDefaultCrawlerBays() })
    },
    failureMessage: crawlerCopy('theCrawlerCouldNotBe'),
    onComplete,
    onCancel,
    onOffRules,
    gameId,
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
        crawlerCopy(slots === 1 ? 'typeChangedMountsOne' : 'typeChangedMountsMany', {
          slots,
          removed: dropped.join(', '),
        })
      )
    }
    updateForm({ type: typeSlug, crew: nextCrew, systems: nextSystems })
  }

  const selectedTechLevel = techLevels.find((t) => t.techLevel === form.techLevel)
  const selectedType = form.type ? (resolveCrawlerType(form.type) ?? undefined) : undefined
  // Bays with an embedded crew NPC (the 10 base bays) — the Crew step's roster.
  const crewBays = allBays.filter((b) => (b as { npc?: unknown }).npc != null)

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
    .filter((s): s is RefSystem & { schemaName: string } => s !== null)

  // The Armament-Bay cap comes from the type's STORED `mutations` rows
  // (weapon_slots; Battle = 2). Selection clamps at this.
  const weaponSlots = crawlerWeaponSlotsFor(form.type)
  const installedWeaponCount = form.systems.filter((slug) => {
    const system = resolveSystemRef(slug)
    return system ? isWeaponSystem(system) : false
  }).length

  // Per-step RuleBrief: the Core Book's own Union Crawler copy, pp.212–213,
  // each quote a `bookQuote` so the rules-fidelity lock holds it to the book.
  // Kept by book step: a step of two parts shows each part's rule.
  const ruleFor = (bookStep: BookStep): StepRule => {
    switch (bookStep) {
      case 'type':
        return {
          rule: (
            <>
              {bookQuote(
                { source: 'Salvage Union Workshop Manual', page: 212 },
                'Once all players have created their Pilot and Mech, the final step is for everyone to create the Union Crawler they share. Your Crawler type provides a unique Ability that only it can do, as well as a special NPC who resides on the Crawler and confers their own bonuses.'
              )}{' '}
              <span style={MUTED}>
                {crawlerCopy('youHaveSavedSoFar', {
                  pilots: crawlerCopy(pilotCount === 1 ? 'pilotCountOne' : 'pilotCountMany', {
                    count: pilotCount,
                  }),
                  mechs: crawlerCopy(mechCount === 1 ? 'mechCountOne' : 'mechCountMany', {
                    count: mechCount,
                  }),
                })}
              </span>
            </>
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 212,
            see: [{ label: crawlerCopy('crawlerTypes'), page: [216, 217] }],
          },
        }
      case 'stats':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 212 },
            'Your Crawler has a set of statistics based on its Tech Level. This includes its Structure Points, Upkeep, and Upgrade cost. Note these down on your Crawler Sheet.'
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 212,
            see: [{ label: crawlerCopy('crawlerStats'), page: 218 }],
          },
        }
      case 'weapons':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 213 },
            'A Union Crawler can mount a single Weapons System in its Armament Bay. To start, this can be any Tech 1 Weapons System of the players’ choice — a Battle Crawler mounts two. Note this down on your Crawler Sheet.'
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 213,
            see: [{ label: crawlerCopy('theSystemList'), page: 162 }],
          },
        }
      case 'crew':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 213 },
            'The Crawler is made of a number of Bays. Each Bay has an NPC assigned to it based on their experience and skill in operating the Bay. You can flesh them out with a Name, Background, Keepsake, and Motto. Each has 4 HP.'
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 213,
            see: [{ label: crawlerCopy('theCrawlerBayList'), page: 221 }],
          },
        }
      case 'identity':
        return {
          rule: bookQuote(
            { source: 'Salvage Union Workshop Manual', page: 212 },
            'Provide your Union Crawler with a unique name and tag. For example, Crawler #132 is also known as ‘Tin Lizzy’. Note these down on your Crawler Sheet. The Scrap Pool below holds the group’s banked Scrap — including whatever your Pilots didn’t spend crafting their Mechs.'
          ),
          cite: {
            source: 'Salvage Union Workshop Manual',
            page: 212,
            see: [{ label: crawlerCopy('theCrawlerNamesTable'), page: 226 }],
          },
        }
    }
  }
  const brief = (bookStep: BookStep) => {
    const { rule, cite } = ruleFor(bookStep)
    return <RuleBrief rule={rule} cite={cite} className="su-wiz-rule-brief" fold />
  }
  /** A part of a step: what it asks in the brief's frame, over its rule. */
  const part = (bookStep: BookStep, ask: ReactNode) => {
    const { rule, cite } = ruleFor(bookStep)
    return (
      <RuleBrief rule={rule} cite={cite} className="su-wiz-rule-brief" fold>
        {ask}
      </RuleBrief>
    )
  }

  // Tracker tab in the action pill: the WEAPONS pip chip rides on the
  // Armament step.
  const trackers =
    step === 'weapons' ? (
      <WizTracker
        label={crawlerCopy('weapons')}
        value={installedWeaponCount}
        max={weaponSlots}
        pips
        testId="weapon-system-count"
      />
    ) : undefined

  const footerNote = !gate.ok ? gate.reason : undefined

  return (
    <WizShell
      gameId={gameId}
      kind="crawler"
      eyebrow={routesCopy('newCrawler')}
      {...shell}
      title={STEP_TITLES[step]}
      trackers={trackers}
      footerNote={footerNote}
      submitLabel={crawlerCopy('createCrawler')}
    >
      {step === 'type' && (
        <>
          {brief('type')}
          <CrawlerTypeSelectStep
            types={types}
            selectedType={form.type}
            onSelect={selectType}
            cite={ruleFor('type').cite}
            // The book's read-only Statistics step, a part under the picker.
            stats={part(
              'stats',
              <CrawlerStatsStep techLevel={selectedTechLevel} selectedType={selectedType} />
            )}
          />
        </>
      )}
      {step === 'weapons' && (
        <>
          {brief('weapons')}
          <SystemsList
            systems={weaponCatalog}
            selectedSystemSlugs={form.systems}
            maxSelectable={weaponSlots}
            installedWeaponCount={installedWeaponCount}
            cite={ruleFor('weapons').cite}
            onChange={(systems) => updateForm({ systems })}
          />
        </>
      )}
      {step === 'crew' && (
        <div className="su-wiz-parts">
          <div className="su-wiz-parts__col">
            {part(
              'identity',
              <CrawlerIdentityStep
                name={form.name}
                description={form.description}
                scrapPool={form.scrapPool}
                onChange={updateForm}
              />
            )}
          </div>
          <div className="su-wiz-parts__col">
            {part(
              'crew',
              <CrawlerCrewStep
                bays={crewBays}
                selectedType={selectedType}
                crew={form.crew}
                onChange={updateForm}
              />
            )}
          </div>
        </div>
      )}
      {step === 'review' && (
        <CrawlerReviewStep
          form={form}
          techLevel={selectedTechLevel}
          selectedType={selectedType}
          systems={chosenSystems}
          submitError={submitError}
        />
      )}
    </WizShell>
  )
}
