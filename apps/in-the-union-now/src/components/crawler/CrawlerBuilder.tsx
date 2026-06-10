import { useEffect, useMemo, useState } from 'react'

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity, SURefMetaCrawlerTechLevel, SURefSystem } from 'salvageunion-reference'
import { toast } from 'suref-react'

import { useEntityStore } from '../../stores/entityStore'
import { CrawlerSchema } from '../../lib/schemas/crawler'
import { computeCrawlerCapacity } from '../../lib/rules/crawlerCapacity'
import {
  EMPTY_CRAWLER_FORM_STATE,
  crawlerFormToCreateInput,
  crawlerFormToUpdatePatch,
  seedDefaultCrawlerBays,
} from '../../lib/wizard/crawlerFormState'
import type { CrawlerWizardFormState } from '../../lib/wizard/crawlerFormState'
import { WizShell } from '../wizard/WizShell'
import { CrawlerIdentityStep } from './CrawlerIdentityStep'
import { CrawlerReviewStep } from './CrawlerReviewStep'
import { CrawlerTypeOptionList, CrawlerTypeDetail } from './CrawlerTypeStep'
import { SystemsList } from './SystemsList'

const STEPS = ['Crawler', 'Systems', 'Identity', 'Review'] as const
type Step = (typeof STEPS)[number]

/** Step heading copy (design §3.2). */
const STEP_TITLES: Record<Step, string> = {
  Crawler: 'Choose Your Crawler',
  Systems: 'Install Systems',
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
 * Returns systems whose numeric techLevel <= the crawler's selected TL.
 * Systems with non-numeric TL (Bio/Nanite) are excluded from TL filtering.
 */
function filterSystemsByTL(allSystems: SURefSystem[], tl: number | null): SURefSystem[] {
  if (tl === null) return []
  return allSystems.filter((s) => {
    if (typeof s.techLevel !== 'number') return false
    return s.techLevel <= tl
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
  const [form, setForm] = useState<CrawlerWizardFormState>(initialState ?? EMPTY_CRAWLER_FORM_STATE)
  const [step, setStep] = useState<Step>('Crawler')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const currentIndex = STEPS.indexOf(step)

  useEffect(() => {
    // crawler-bays is preloaded so the bay preview grid and the default-bay
    // seeding at submit time can read the SRD catalog synchronously.
    void SalvageUnionReference.preload(['crawler-tech-levels', 'systems', 'crawler-bays']).then(
      () => {
        const tls = SalvageUnionReference.CrawlerTechLevels.all()
        setTechLevels([...tls].sort((a, b) => a.techLevel - b.techLevel))
        setAllSystems(SalvageUnionReference.Systems.all())
        setAllBays(SalvageUnionReference.CrawlerBays.all() as unknown as SURefEntity[])
      }
    )
  }, [])

  function updateForm(patch: Partial<CrawlerWizardFormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function canAdvance(): boolean {
    switch (step) {
      case 'Crawler':
        return form.techLevel !== null
      case 'Systems':
        return true // systems are optional
      case 'Identity':
        return form.name.trim() !== ''
      case 'Review':
        return form.techLevel !== null && form.name.trim() !== ''
    }
  }

  function goNext() {
    if (step === 'Review') {
      void handleSubmit()
      return
    }
    setStep(STEPS[currentIndex + 1]!)
  }

  function goBack() {
    if (currentIndex > 0) setStep(STEPS[currentIndex - 1]!)
  }

  async function handleSubmit() {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const store = useEntityStore.getState()

      // Upsert branch (plan 3.1): update when editing — NEVER a second create.
      // The patch touches only wizard-owned fields; bays/NPC live state stays.
      if (crawlerId) {
        await store.update('crawler', crawlerId, crawlerFormToUpdatePatch(form))
        toast.success(`Saved ${form.name.trim() || 'crawler'}.`)
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
      onComplete(created.id)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save crawler.')
      setIsSubmitting(false)
    }
  }

  const selectedTechLevel = techLevels.find((t) => t.techLevel === form.techLevel)
  const filteredSystems = filterSystemsByTL(allSystems, form.techLevel)
  const chosenSystems = form.systems
    .map((id) => allSystems.find((s) => s.id === id))
    .filter((s): s is SURefSystem => s !== undefined)

  // Live capacity computation (soft-warn only — does NOT block submit).
  // Crawler bays are the fixed SRD set, so only the system soft-cap surfaces.
  const crawlerCapacity = useMemo(
    () =>
      computeCrawlerCapacity({
        techLevel: form.techLevel ?? 0,
        bays: [],
        systems: form.systems,
      }),
    [form.techLevel, form.systems]
  )
  const isOverCapacity =
    form.techLevel !== null &&
    crawlerCapacity.violations.some((v) => v.kind === 'systems-over-capacity')

  const capacityNotice =
    isOverCapacity && (step === 'Systems' || step === 'Review') ? (
      <p
        role="status"
        className="rounded-[3px] border-[1.5px] border-rust bg-rust/10 px-3 py-2 text-sm text-ink"
      >
        <strong>Over capacity</strong> — {crawlerCapacity.systemsUsed} systems installed,{' '}
        {crawlerCapacity.systemsMax} supported at this tech level. You can still save; review before
        play.
      </p>
    ) : undefined

  const subtitle = (() => {
    switch (step) {
      case 'Crawler':
        return 'Pick a tech level. It sets Structure Points and which systems you can install — every crawler ships with the full bay set.'
      case 'Systems':
        return (
          <>
            <span data-testid="system-count">
              {crawlerCapacity.systemsUsed} /{' '}
              {crawlerCapacity.systemsMax > 0 ? crawlerCapacity.systemsMax : '—'} systems
            </span>{' '}
            · Tech Level {form.techLevel ?? '—'} and below. Capacity warns, never blocks.
          </>
        )
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
      onStepClick={(i) => setStep(STEPS[i]!)}
      title={STEP_TITLES[step]}
      subtitle={subtitle}
      optionPane={
        step === 'Crawler' ? (
          <CrawlerTypeOptionList
            techLevels={techLevels}
            selectedTechLevel={form.techLevel}
            onSelect={(techLevel) => {
              // Creation resets systems on TL change (the offer changes);
              // edit keeps them — an upgraded crawler retains its loadout.
              updateForm(isEdit ? { techLevel } : { techLevel, systems: [] })
            }}
          />
        ) : undefined
      }
      notice={capacityNotice}
      onBack={currentIndex > 0 ? goBack : undefined}
      onCancel={onCancel}
      onNext={goNext}
      nextDisabled={!canAdvance()}
      busy={isSubmitting}
      submitLabel={isEdit ? 'Save Crawler' : 'Create Crawler ✦'}
    >
      {step === 'Crawler' && <CrawlerTypeDetail selected={selectedTechLevel} bays={allBays} />}
      {step === 'Systems' && (
        <SystemsList
          systems={filteredSystems}
          selectedSystemSlugs={form.systems}
          onChange={(systems) => updateForm({ systems })}
        />
      )}
      {step === 'Identity' && (
        <CrawlerIdentityStep
          name={form.name}
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
