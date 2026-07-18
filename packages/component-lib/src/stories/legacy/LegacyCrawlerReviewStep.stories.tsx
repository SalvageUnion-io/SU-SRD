/**
 * Legacy "before" capture — ITUN crawler wizard `CrawlerReviewStep`.
 *
 * Reproduces the presentational shell of
 * apps/in-the-union-now/src/components/crawler/CrawlerReviewStep.tsx VERBATIM
 * (lines 27-146): a two-column recap — a bordered kv-panel of `KvRow`s (label
 * rail + value, missing values shown `rust` "required") on the left, the chosen
 * type + weapon `ReferenceEntityDisplay` cards stacked on the right (fresh
 * weapons carry an 'intact' status). Structure Points render through the real
 * `crawlerMaxSPParts` rule. Shared atoms come from `component-lib`; the app-only
 * `LAYOUT.reviewLabelRail` (= `w-[120px]`), `toScrapPoolPatch`, and the form
 * state type are mirrored locally. Driven with real `SalvageUnionReference`
 * fixtures. L1 reconciliation: freeze the "before".
 */

import type { Story } from '@ladle/react'
import type { SURefEntity, SURefSystem } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { crawlerMaxSPParts } from 'salvageunion-reference/rules'
import { cn, ReferenceEntityDisplay } from 'component-lib'
import { Caption } from '../_harness'

// --- Mirror of ITUN's app-only types + constants. ---
type ScrapPoolForm = {
  tl1: number
  tl2: number
  tl3: number
  tl4: number
  tl5: number
  tl6: number
}
type CrewNpcForm = { name?: string; description?: string; keepsake?: string; motto?: string }
type CrawlerWizardFormState = {
  name: string
  description: string
  techLevel: number | null
  type: string | null
  systems: string[]
  crew: Record<string, CrewNpcForm>
  scrapPool: ScrapPoolForm
  upgradePool: number
}

/** Verbatim mirror of LAYOUT.reviewLabelRail (lib/layout.ts). */
const REVIEW_LABEL_RAIL = 'w-[120px]'

/** Verbatim mirror of toScrapPoolPatch (crawlerFormState.ts:147-154). */
function toScrapPoolPatch(pool: ScrapPoolForm): Partial<ScrapPoolForm> {
  const out: Partial<ScrapPoolForm> = {}
  for (const key of ['tl1', 'tl2', 'tl3', 'tl4', 'tl5', 'tl6'] as const) {
    if (pool[key] > 0) out[key] = pool[key]
  }
  return out
}

// Verbatim reproduction of KvRow (CrawlerReviewStep.tsx:27-43).
function KvRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-4 border-b border-wk-bg-2 py-2.5 last:border-0">
      <span
        className={cn(
          REVIEW_LABEL_RAIL,
          'shrink-0 font-cond text-xs font-bold uppercase tracking-widest text-wk-muted'
        )}
      >
        {label}
      </span>
      <span className={value ? 'font-body text-sm text-ink' : 'text-rust'}>
        {value ?? 'required'}
      </span>
    </div>
  )
}

type TechLevelEntity = ReturnType<typeof SalvageUnionReference.CrawlerTechLevels.all>[number]
type CrawlerTypeEntity = ReturnType<typeof SalvageUnionReference.Crawlers.all>[number]

// Verbatim reproduction of CrawlerReviewStep.tsx (lines 54-146).
function CrawlerReviewStep({
  form,
  techLevel,
  selectedType,
  systems,
  bayCount,
  submitError,
}: {
  form: CrawlerWizardFormState
  techLevel: TechLevelEntity | undefined
  selectedType: CrawlerTypeEntity | undefined
  systems: SURefSystem[]
  bayCount: number
  submitError: string | null
}) {
  const scrap = toScrapPoolPatch(form.scrapPool)
  const scrapSummary = Object.entries(scrap)
    .map(([bucket, qty]) => `T${bucket.slice(2)} ×${qty}`)
    .join(' · ')

  const sp = techLevel
    ? crawlerMaxSPParts({ techLevel: `tech-${techLevel.techLevel}`, type: selectedType?.id })
    : undefined
  const spSummary = sp
    ? sp.typeBonus > 0
      ? `${sp.base} + ${sp.typeBonus} type bonus = ${sp.total} SP (starts at full)`
      : `${sp.total} SP (starts at full)`
    : null

  const crewNames = Object.values(form.crew)
    .map((entry) => entry.name?.trim())
    .filter((name): name is string => !!name && name.length > 0)

  const isAugmented = selectedType?.name === 'Augmented'

  const rows: [string, string | null][] = [
    ['Name', form.name.trim() || null],
    ['Type', selectedType ? selectedType.name : null],
    [
      'Ability',
      selectedType?.actions && selectedType.actions.length > 0
        ? selectedType.actions.join(', ')
        : '—',
    ],
    ['Crawler', techLevel ? `${techLevel.name} · Tech Level ${techLevel.techLevel}` : null],
    ['Structure', spSummary],
    ['Bays', `Full base set · ${bayCount} bays, seeded automatically · all Intact`],
    ['Weapons', systems.length > 0 ? systems.map((s) => s.name).join(', ') : null],
    ['Scrap Pool', scrapSummary || '—'],
    ['Crew', crewNames.length > 0 ? crewNames.join(', ') : 'Unnamed — fill in during play'],
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* kv-panel */}
      <div className="space-y-3 self-start">
        <div className="rounded-[3px] border-chrome border-ink bg-paper p-4 text-sm">
          {rows.map(([k, v]) => (
            <KvRow key={k} label={k} value={v} />
          ))}
          {submitError && (
            <p role="alert" className="mt-3 text-sm text-rust">
              {submitError}
            </p>
          )}
        </div>
        {isAugmented && (
          <p className="m-0 rounded-[3px] border-chrome border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink">
            <span className="font-cond font-bold uppercase tracking-caps">Reminder — </span>
            every Pilot gains <strong>+1 Training Point</strong> (Augment ability tree only). Apply
            it on each Pilot&rsquo;s sheet yourself.
          </p>
        )}
      </div>

      {/* chosen cards */}
      <div className="space-y-3">
        {selectedType && (
          <ReferenceEntityDisplay
            data={selectedType as unknown as SURefEntity}
            compact
            hide={{ choices: true }}
          />
        )}
        {systems.map((system) => (
          <ReferenceEntityDisplay
            key={system.id}
            data={system as unknown as SURefEntity}
            compact
            status="intact"
            hide={{ actions: true, choices: true }}
          />
        ))}
        {systems.length === 0 && (
          <p className="m-0 font-body text-sm text-current">No weapons mounted.</p>
        )}
      </div>
    </div>
  )
}

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Crawler Review Step' }

export const Default: Story = () => {
  const techLevel = SalvageUnionReference.CrawlerTechLevels.all().find((t) => t.techLevel === 1)
  const selectedType = SalvageUnionReference.Crawlers.all().find((t) => t.name === 'Battle')
  const systems = SalvageUnionReference.Systems.all().slice(0, 2)

  if (!techLevel || !selectedType) {
    return <Caption>Crawler review fixtures missing</Caption>
  }

  const form: CrawlerWizardFormState = {
    name: 'Crawler #132, aka ‘Tin Lizzy’',
    description: 'A patched-together Battle crawler, veteran of the Barrens run.',
    techLevel: 1,
    type: selectedType.id,
    systems: systems.map((s) => s.id),
    crew: { [selectedType.id]: { name: 'Old Marta' } },
    scrapPool: { tl1: 4, tl2: 2, tl3: 0, tl4: 0, tl5: 0, tl6: 0 },
    upgradePool: 0,
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Caption>
          CrawlerReviewStep — filled recap: kv-panel + chosen type/weapon cards
          (CrawlerReviewStep.tsx:54-146)
        </Caption>
        <CrawlerReviewStep
          form={form}
          techLevel={techLevel}
          selectedType={selectedType}
          systems={systems}
          bayCount={14}
          submitError={null}
        />
      </div>

      <div>
        <Caption>
          CrawlerReviewStep — empty form with a submit error: the `rust` "required" rows
        </Caption>
        <CrawlerReviewStep
          form={{
            name: '',
            description: '',
            techLevel: 1,
            type: null,
            systems: [],
            crew: {},
            scrapPool: { tl1: 0, tl2: 0, tl3: 0, tl4: 0, tl5: 0, tl6: 0 },
            upgradePool: 0,
          }}
          techLevel={techLevel}
          selectedType={undefined}
          systems={[]}
          bayCount={14}
          submitError="Choose a crawler type before saving."
        />
      </div>
    </div>
  )
}
