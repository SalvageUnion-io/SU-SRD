import { useEffect, useMemo, useState } from 'react'

import { SalvageUnionReference } from 'salvageunion-reference'
import type {
  SURefCrawler,
  SURefEntity,
  SURefMetaCrawlerTechLevel,
  SURefSystem,
} from 'salvageunion-reference'
import { toast } from 'suref-react'

import { useEntityStore } from '../../stores/entityStore'
import { CrawlerSchema } from '../../lib/schemas/crawler'
import { computeCrawlerCapacity } from '../../lib/rules/crawlerCapacity'
import { isWeaponSystem } from '../../lib/rules/crawlerSystems'
import {
  EMPTY_CRAWLER_FORM_STATE,
  crawlerFormToCreateInput,
  crawlerFormToUpdatePatch,
  seedDefaultCrawlerBays,
} from '../../lib/wizard/crawlerFormState'
import type { CrawlerWizardFormState } from '../../lib/wizard/crawlerFormState'
import { applyCrawlerCrewAndTypeEdit } from '../../lib/wizard/applyCrawlerEdit'
import type { SoftWarning } from '../../lib/rules/types'
import { SoftWarningBanner } from '../shared/SoftWarningBanner'
import { WizShell } from '../wizard/WizShell'
import { CrawlerCrewStep } from './CrawlerCrewStep'
import { CrawlerIdentityStep } from './CrawlerIdentityStep'
import { CrawlerReviewStep } from './CrawlerReviewStep'
import { CrawlerTypeOptionList, CrawlerTypeDetail } from './CrawlerTypeStep'
import { SystemsList } from './SystemsList'
import {
  clearWizardDraft,
  readWizardDraft,
  useWizardDraftSync,
  wizardDraftKey,
} from '../../lib/wizard/wizardDraft'

const STEPS = ['Crawler', 'Systems', 'Crew', 'Identity', 'Review'] as const
type Step = (typeof STEPS)[number]

/** Step heading copy (design §3.2). */
const STEP_TITLES: Record<Step, string> = {
  Crawler: 'Choose Your Crawler',
  // This step installs weapon systems into the Armament Bay (the only place a
  // crawler mounts weapons); the title names it so the mount is unambiguous.
  Systems: 'Arm the Armament Bay',
  Crew: 'Meet Your Crew',
  Identity: 'Name Your Crawler',
  Review: 'Review',
}

type CrawlerBuilderProps = {
  /** Called on successful create/save with the crawler's id. */
  onComplete: (crawlerId: string) => void
  /** Called when the user cancels. */
  onCancel: () => void
  /**
   * Id of an existing crawler being edited. When provided, handleSubmit takes
   * the update branch (never duplicates) and the seeded bay set / live-play
   * state stays untouched (plan 3.1).
   */
  crawlerId?: string
  /**
   * Initial form state — pass `crawlerToFormState(crawler)` in edit mode.
   * Defaults to the empty creation state.
   */
  initialState?: CrawlerWizardFormState
}

/**
 * Returns WEAPONS systems whose numeric techLevel <= the crawler's selected TL.
 * The Systems step installs into the Armament Bay, which holds weapons systems
 * only (Core Book p. 213), so non-weapon systems (Armour Plating, Cargo Pod, …)
 * are excluded outright. Systems with non-numeric TL (Bio/Nanite) are also
 * excluded from TL filtering.
 */
function filterSystemsByTL(allSystems: SURefSystem[], tl: number | null): SURefSystem[] {
  if (tl === null) return []
  return allSystems.filter((s) => {
    if (typeof s.techLevel !== 'number') return false
    if (s.techLevel > tl) return false
    return isWeaponSystem(s)
  })
}

/**
 * Multi-step crawler wizard on the shared WizShell skeleton (plan 3.2).
 *
 * Edit seams are layout-agnostic (plan 3.1): the entity→form mapping happens
 * in lib/wizard/crawlerFormState.ts, the upsert branch lives in handleSubmit,
 * and step components carry NO edit logic.
 *
 * Crawler bays are NOT chosen here — every crawler installs the full SRD bay
 * set on creation (seeded via crawlerFormState.seedDefaultCrawlerBays); the
 * Crawler step's detail pane previews that complement as a 2-col head grid.
 */
export function CrawlerBuilder({
  onComplete,
  onCancel,
  crawlerId,
  initialState,
}: CrawlerBuilderProps) {
  const isEdit = crawlerId !== undefined

  const [techLevels, setTechLevels] = useState<SURefMetaCrawlerTechLevel[]>([])
  const [allSystems, setAllSystems] = useState<SURefSystem[]>([])
  const [allBays, setAllBays] = useState<SURefEntity[]>([])
  const [types, setTypes] = useState<SURefCrawler[]>([])
  // Draft-aware init: a stored session draft (refresh, back-nav, PWA reload)
  // wins over the pristine initial state; cleared on submit/cancelled exit.
  const draftKey = wizardDraftKey('crawler', crawlerId)
  const [form, setForm] = useState<CrawlerWizardFormState>(
    () =>
      readWizardDraft<CrawlerWizardFormState>(draftKey) ?? initialState ?? EMPTY_CRAWLER_FORM_STATE
  )
  const formDirty = useWizardDraftSync(draftKey, form, initialState ?? EMPTY_CRAWLER_FORM_STATE)
  const [step, setStep] = useState<Step>('Crawler')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const currentIndex = STEPS.indexOf(step)

  useEffect(() => {
    // crawlers drives the type selection; crawler-bays seeds the default bays
    // + the Crew step; crawler-tech-levels stays for the SP/capacity lookup;
    // actions resolves each system's damage so isWeaponSystem can filter the
    // Systems list down to weapons.
    void SalvageUnionReference.preload([
      'crawlers',
      'crawler-tech-levels',
      'systems',
      'crawler-bays',
      'actions',
    ]).then(() => {
      const tls = SalvageUnionReference.CrawlerTechLevels.all()
      setTechLevels([...tls].sort((a, b) => a.techLevel - b.techLevel))
      setAllSystems(SalvageUnionReference.Systems.all())
      setAllBays(SalvageUnionReference.CrawlerBays.all() as unknown as SURefEntity[])
      setTypes(SalvageUnionReference.Crawlers.all())
    })
  }, [])

  function updateForm(patch: Partial<CrawlerWizardFormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  /**
   * Choose a crawler type. When switching away from a previously-chosen type,
   * drop that old type's crew entry (keyed by the old type id) so it can never
   * be persisted as a phantom bay / stale type NPC on save.
   */
  function selectType(type: string) {
    setForm((prev) => {
      if (prev.type === type) return { ...prev, type }
      const nextCrew = { ...prev.crew }
      if (prev.type !== null) delete nextCrew[prev.type]
      return { ...prev, type, crew: nextCrew }
    })
  }

  function canAdvance(): boolean {
    switch (step) {
      case 'Crawler':
        // New crawlers must choose a type; editing a legacy (untyped) crawler
        // can advance without one (type stays absent, TL is preserved).
        return isEdit || form.type !== null
      case 'Systems':
        return true // systems are optional
      case 'Crew':
        return true // crew details are all optional
      case 'Identity':
        return form.name.trim() !== ''
      case 'Review':
        return (isEdit || form.type !== null) && form.name.trim() !== ''
    }
  }

  function goNext() {
    if (step === 'Review') {
      void handleSubmit()
      return
    }
    const next = STEPS[currentIndex + 1]
    if (next) setStep(next)
  }

  function goBack() {
    const prev = STEPS[currentIndex - 1]
    if (currentIndex > 0 && prev) setStep(prev)
  }

  async function handleSubmit() {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const store = useEntityStore.getState()

      // Upsert branch (plan 3.1): update when editing — NEVER a second create.
      // The patch touches only wizard-owned fields; bays/NPC live state stays.
      if (crawlerId) {
        // Read the stored record BEFORE the wizard patch so we know the old
        // type (the patch overwrites `type`).
        const stored = store.get('crawler', crawlerId)
        const oldType = stored?.type ?? null

        await store.update('crawler', crawlerId, crawlerFormToUpdatePatch(form))

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
      const maxSP = techLevels.find((t) => t.techLevel === form.techLevel)?.structurePoints
      // Seed the full SRD bay set — the official sheets pre-print every bay.
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
  const selectedType = types.find((t) => t.id === form.type)
  // Bays with an embedded crew NPC (the 10 base bays) — the Crew step's roster.
  const crewBays = allBays.filter(
    (b): b is SURefEntity & { npc: object } => (b as { npc?: unknown }).npc != null
  ) as unknown as Array<{
    id: string
    name: string
    npc?: { position?: string; choices?: ReadonlyArray<{ id: string; name: string }> }
  }>
  const filteredSystems = filterSystemsByTL(allSystems, form.techLevel)
  const chosenSystems = form.systems
    .map((id) => allSystems.find((s) => s.id === id))
    .filter((s): s is SURefSystem => s !== undefined)

  // The Weapons System cap is gated by crawler type, not tech level: every
  // crawler mounts one system, except the Battle Crawler (two). The Battle
  // Crawler is the type whose special ability is "Improved Armour and
  // Armaments" (Core Book p. 216) — gating off the action name rather than the
  // display name keeps this stable if the type is renamed.
  const isBattleCrawler = selectedType?.actions?.includes('Improved Armour and Armaments') ?? false

  // Live capacity computation (soft-warn only — does NOT block submit).
  // Crawler bays are the fixed SRD set, so only the system soft-cap surfaces.
  const crawlerCapacity = useMemo(() => {
    // Only WEAPONS systems count toward the Armament-Bay cap (Core Book p. 213 /
    // p. 216); non-weapon systems (Armour Plating, Cargo Pod, …) are unlimited.
    // Resolve each chosen system and keep the damage-dealing ones.
    const weaponSystems = form.systems.filter((id) => {
      const system = allSystems.find((s) => s.id === id)
      return system ? isWeaponSystem(system) : false
    })
    return computeCrawlerCapacity({
      techLevel: form.techLevel ?? 0,
      bays: [],
      weaponSystems,
      isBattleCrawler,
    })
  }, [form.techLevel, form.systems, allSystems, isBattleCrawler])
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
    step === 'Systems' || step === 'Review' ? (
      <SoftWarningBanner warnings={capacityWarnings} />
    ) : undefined

  const subtitle = (() => {
    switch (step) {
      case 'Crawler':
        return 'Pick a crawler type. It grants a special action and a special NPC — every crawler ships with the full bay set and starts at Tech Level 1.'
      case 'Systems':
        return (
          <>
            Mount your crawler’s Weapons Systems in the Armament Bay —{' '}
            <span data-testid="weapon-system-count">
              {crawlerCapacity.weaponSystemsUsed} /{' '}
              {crawlerCapacity.weaponSystemsMax > 0 ? crawlerCapacity.weaponSystemsMax : '—'} weapon
              systems
            </span>{' '}
            · Tech Level {form.techLevel ?? '—'} and below. The Armament-Bay cap is enforced — one
            Weapons System per crawler (two for a Battle Crawler).
          </>
        )
      case 'Crew':
        return 'Name and detail each bay’s crew lead and your crawler type’s special NPC. All optional.'
      case 'Identity':
        return 'Name your crawler and set its starting resources.'
      case 'Review':
        return isEdit ? 'Check the changes, then save.' : 'Check the build, then create.'
    }
  })()

  return (
    <WizShell
      eyebrow={isEdit ? 'Edit Crawler' : 'New Crawler'}
      steps={STEPS}
      active={currentIndex}
      onStepClick={(i) => {
        const s = STEPS[i]
        if (s) setStep(s)
      }}
      title={STEP_TITLES[step]}
      subtitle={subtitle}
      optionPane={
        step === 'Crawler' ? (
          <CrawlerTypeOptionList types={types} selectedType={form.type} onSelect={selectType} />
        ) : undefined
      }
      notice={capacityNotice}
      onBack={currentIndex > 0 ? goBack : undefined}
      onCancel={() => {
        clearWizardDraft(draftKey)
        onCancel()
      }}
      confirmCancel={formDirty}
      onNext={goNext}
      nextDisabled={!canAdvance()}
      busy={isSubmitting}
      submitLabel={isEdit ? 'Save Crawler' : 'Create Crawler ✦'}
    >
      {step === 'Crawler' && <CrawlerTypeDetail selected={selectedType} />}
      {step === 'Systems' && (
        <SystemsList
          systems={filteredSystems}
          selectedSystemSlugs={form.systems}
          maxSelectable={crawlerCapacity.weaponSystemsMax}
          installedWeaponCount={crawlerCapacity.weaponSystemsUsed}
          onChange={(systems) => updateForm({ systems })}
        />
      )}
      {step === 'Crew' && (
        <CrawlerCrewStep
          bays={crewBays}
          selectedType={selectedType}
          crew={form.crew}
          onChange={updateForm}
        />
      )}
      {step === 'Identity' && (
        <CrawlerIdentityStep
          name={form.name}
          description={form.description}
          scrapPool={form.scrapPool}
          upgradePool={form.upgradePool}
          onChange={updateForm}
        />
      )}
      {step === 'Review' && (
        <CrawlerReviewStep
          form={form}
          techLevel={selectedTechLevel}
          systems={chosenSystems}
          bayCount={allBays.length}
          submitError={submitError}
        />
      )}
    </WizShell>
  )
}
