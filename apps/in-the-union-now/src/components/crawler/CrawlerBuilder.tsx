import { useEffect, useMemo, useState } from 'react'

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefSystem } from 'salvageunion-reference'

import { useEntityStore } from '../../stores/entityStore'
import { CrawlerSchema } from '../../lib/schemas/crawler'
import type { Crawler } from '../../lib/schemas/crawler'
import { computeCrawlerCapacity } from '../../lib/rules/crawlerCapacity'
import { Button } from '../ui/button'
import { SystemsList } from './SystemsList'
import { TechLevelSelector } from './TechLevelSelector'

type CrawlerBuilderProps = {
  /** Called after the crawler is successfully created. */
  onCreated: () => void
  /** Called when the user wants to cancel / go back. */
  onCancel: () => void
}

const CRAWLER_STEPS = ['Tech Level', 'Loadout', 'Identity', 'Review'] as const
type CrawlerStep = (typeof CRAWLER_STEPS)[number]

type FormState = {
  name: string
  techLevel: number | null
  systems: string[]
}

const INITIAL_STATE: FormState = {
  name: '',
  techLevel: null,
  systems: [],
}

type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

type BayWithNpc = { id: string; npc?: { hitPoints?: number } }

/**
 * Build the default crawler-bay set seeded onto every new crawler.
 *
 * The official crawler sheets pre-print all SRD bays as fixed sections, so a
 * fresh crawler installs the full catalog. Each entry seeds the embedded NPC's
 * current HP from the bay's `npc.hitPoints` (4). The array is extensible — a
 * crawler can gain more bays later.
 */
function seedDefaultCrawlerBays(): CrawlerBayEntry[] {
  let bays: BayWithNpc[]
  try {
    bays = SalvageUnionReference.CrawlerBays.all() as unknown as BayWithNpc[]
  } catch {
    bays = []
  }
  return bays.map((bay) => {
    const maxHP = bay.npc?.hitPoints
    return {
      bayRef: bay.id,
      ...(typeof maxHP === 'number' ? { npcCurrentHP: maxHP } : {}),
    }
  })
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

export function CrawlerBuilder({ onCreated, onCancel }: CrawlerBuilderProps) {
  const [techLevels, setTechLevels] = useState<
    { id: string; name: string; techLevel: number; structurePoints?: number }[]
  >([])
  const [allSystems, setAllSystems] = useState<SURefSystem[]>([])
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [step, setStep] = useState<CrawlerStep>('Tech Level')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentIndex = CRAWLER_STEPS.indexOf(step)

  function canAdvance(): boolean {
    switch (step) {
      case 'Tech Level':
        return form.techLevel !== null
      case 'Loadout':
        return true
      case 'Identity':
        return form.name.trim() !== ''
      case 'Review':
        return true
    }
  }

  function goNext() {
    if (currentIndex < CRAWLER_STEPS.length - 1) setStep(CRAWLER_STEPS[currentIndex + 1]!)
  }

  function goBack() {
    if (currentIndex > 0) setStep(CRAWLER_STEPS[currentIndex - 1]!)
  }

  useEffect(() => {
    // crawler-bays is preloaded so the default-bay seeding at submit time can
    // read the SRD catalog synchronously.
    void SalvageUnionReference.preload(['crawler-tech-levels', 'systems', 'crawler-bays']).then(
      () => {
        const tls = SalvageUnionReference.CrawlerTechLevels.all()
        const sorted = [...tls].sort((a, b) => a.techLevel - b.techLevel)
        setTechLevels(sorted)
        setAllSystems(SalvageUnionReference.Systems.all())
      }
    )
  }, [])

  const filteredSystems = filterSystemsByTL(allSystems, form.techLevel)

  // ---------------------------------------------------------------------------
  // Live capacity computation (soft-warn only — does NOT block submit)
  //
  // Crawler bays are now the fixed SRD set (seeded on creation), not a chosen
  // crew/mech loadout, so only the system soft-cap is surfaced here.
  // ---------------------------------------------------------------------------
  const crawlerCapacity = useMemo(
    () =>
      computeCrawlerCapacity({
        techLevel: form.techLevel ?? 0,
        bays: [],
        systems: form.systems,
      }),
    [form.techLevel, form.systems]
  )

  const hasCapacityViolations =
    form.techLevel !== null &&
    crawlerCapacity.violations.some((v) => v.kind === 'systems-over-capacity')

  async function handleSubmit() {
    if (!form.techLevel) {
      setError('Please select a tech level.')
      return
    }
    if (!form.name.trim()) {
      setError('Please enter a crawler name.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const now = new Date().toISOString()
      const maxSP = techLevels.find((t) => t.techLevel === form.techLevel)?.structurePoints
      const rawInput = {
        schemaVersion: 1 as const,
        name: form.name.trim(),
        techLevel: `tech-${form.techLevel}`,
        // Seed the full SRD bay set — the official sheets pre-print every bay.
        crawlerBays: seedDefaultCrawlerBays(),
        systems: form.systems,
        // Fresh crawlers start at full SP for their tech level.
        currentSP: maxSP,
      }

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
        setError(`Validation error: ${messages}`)
        setIsSubmitting(false)
        return
      }

      // The db layer injects id, createdAt, updatedAt — pass only the user data.
      await useEntityStore.getState().create('crawler', rawInput)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create crawler.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const capacitySidebar = (
    <div className="flex flex-col gap-4 lg:w-64 shrink-0">
      <div
        aria-label="Capacity summary"
        className="sticky top-4 flex flex-col gap-3 rounded-md border border-su-black bg-white p-4"
      >
        <h3 className="font-cond text-sm font-bold uppercase tracking-[0.08em] text-su-orange-dark">
          Capacity
        </h3>

        {/* Systems */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-cond font-semibold uppercase tracking-[0.06em] text-su-grey-dark">
              Systems
            </span>
            <span
              className={
                crawlerCapacity.systemsUsed > crawlerCapacity.systemsMax &&
                crawlerCapacity.systemsMax > 0
                  ? 'font-mono font-semibold tabular-nums text-roll-cascade'
                  : 'font-mono tabular-nums text-su-black'
              }
            >
              {crawlerCapacity.systemsUsed}&nbsp;/&nbsp;
              {crawlerCapacity.systemsMax > 0 ? crawlerCapacity.systemsMax : '—'}
            </span>
          </div>
        </div>

        {/* Capacity warning — amber → roll-failure token */}
        {hasCapacityViolations && (
          <div
            role="region"
            aria-label="Capacity warning"
            className="rounded-[3px] border border-roll-failure bg-roll-failure/10 p-2 text-xs text-su-black"
          >
            <strong>Over capacity</strong> — review before saving.
          </div>
        )}

        {form.techLevel === null && (
          <p className="text-xs text-su-grey-dark opacity-70">Select a tech level to see caps.</p>
        )}
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl">
      <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
        {/* Progress indicator — vertical stepper rail on desktop, horizontal on mobile */}
        <nav aria-label="Wizard steps" className="mb-6 lg:mb-0">
          <p className="mb-3 hidden font-cond text-xs font-bold uppercase tracking-widest text-su-orange-dark lg:block">
            New Crawler
          </p>
          <ol className="flex items-center gap-1 text-xs lg:sticky lg:top-4 lg:flex-col lg:items-stretch lg:gap-0.5">
            {CRAWLER_STEPS.map((s, i) => {
              const isDone = i < currentIndex
              const isActive = s === step
              return (
                <li
                  key={s}
                  className={[
                    'flex items-center gap-2 rounded px-2 py-1 lg:px-3 lg:py-2',
                    isActive
                      ? 'border-l-[3px] border-su-orange-dark bg-su-blue-pale font-cond font-bold text-su-black'
                      : isDone
                        ? 'font-cond text-su-black opacity-70'
                        : 'font-cond text-su-grey-dark opacity-40',
                  ].join(' ')}
                >
                  <span className="hidden font-cond font-bold lg:inline">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{s}</span>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* Content column */}
        <div className="min-w-0 space-y-6">
          <h2 className="text-2xl font-bold tracking-wide">
            {step === 'Tech Level' && 'Choose a Tech Level'}
            {step === 'Loadout' && 'Systems'}
            {step === 'Identity' && 'Name Your Crawler'}
            {step === 'Review' && 'Review & Create'}
          </h2>

          {/* Tech Level */}
          {step === 'Tech Level' && (
            <TechLevelSelector
              techLevels={techLevels}
              selectedTechLevel={form.techLevel}
              onChange={(tl) => setForm((f) => ({ ...f, techLevel: tl, systems: [] }))}
            />
          )}

          {/* Loadout — systems, capacity alongside. Crawler bays are the fixed
              SRD set and are seeded automatically on creation (not chosen). */}
          {step === 'Loadout' && (
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="flex min-w-0 flex-1 flex-col gap-6">
                <p className="rounded-[3px] border border-su-grey-light bg-su-blue-pale/40 p-3 text-xs text-su-ink-soft">
                  Every crawler is built with its full set of bays — Command, Mech, Storage and the
                  rest — each crewed by its own NPC. They&rsquo;re installed automatically; manage
                  their crew and HP from the crawler sheet.
                </p>
                <SystemsList
                  systems={filteredSystems}
                  selectedSystemSlugs={form.systems}
                  onChange={(systems) => setForm((f) => ({ ...f, systems }))}
                />
              </div>
              {capacitySidebar}
            </div>
          )}

          {/* Identity */}
          {step === 'Identity' && (
            <div>
              <label
                htmlFor="crawler-name"
                className="mb-2 block font-cond text-xs font-semibold uppercase tracking-[0.04em] text-su-black"
              >
                Crawler Name <span className="text-su-rust">*</span>
              </label>
              <input
                id="crawler-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="The Wandering Throne"
                required
                className="w-full rounded border border-su-black bg-white px-3 py-2.5 text-sm text-su-black placeholder:text-su-grey focus:outline-none focus:ring-2 focus:ring-su-orange"
              />
            </div>
          )}

          {/* Review */}
          {step === 'Review' && (
            <div className="space-y-3 rounded-md border-[1.5px] border-su-black bg-white p-5">
              <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
                <dt className="font-cond font-semibold uppercase tracking-wide text-su-ink-soft">
                  Name
                </dt>
                <dd>{form.name.trim() || '—'}</dd>
                <dt className="font-cond font-semibold uppercase tracking-wide text-su-ink-soft">
                  Tech Level
                </dt>
                <dd>{form.techLevel ?? '—'}</dd>
                <dt className="font-cond font-semibold uppercase tracking-wide text-su-ink-soft">
                  Crawler Bays
                </dt>
                <dd>All bays (seeded automatically)</dd>
                <dt className="font-cond font-semibold uppercase tracking-wide text-su-ink-soft">
                  Systems
                </dt>
                <dd>{form.systems.length}</dd>
              </dl>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="flex justify-between border-t border-su-grey-light pt-4">
            <div className="flex gap-2">
              {currentIndex > 0 && (
                <Button type="button" variant="ghost" onClick={goBack} disabled={isSubmitting}>
                  Back
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
              </Button>
            </div>

            {step !== 'Review' ? (
              <Button type="button" onClick={goNext} disabled={!canAdvance()}>
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting || !form.techLevel || !form.name.trim()}
              >
                {isSubmitting ? 'Creating…' : 'Create Crawler'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
