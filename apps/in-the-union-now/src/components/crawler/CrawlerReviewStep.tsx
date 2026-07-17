import type {
  SURefCrawler,
  SURefEntity,
  SURefMetaCrawlerTechLevel,
  SURefSystem,
} from 'salvageunion-reference'
import { crawlerMaxSPParts } from 'salvageunion-reference/rules'
import { ReferenceEntityDisplay } from 'component-lib'
import { LAYOUT } from '../../lib/layout'
import { cn } from '../../lib/utils'
import type { CrawlerWizardFormState } from '../../lib/wizard/crawlerFormState'
import { toScrapPoolPatch } from '../../lib/wizard/crawlerFormState'

type CrawlerReviewStepProps = {
  form: CrawlerWizardFormState
  /** Resolved tech-level entity for the form's chosen level. */
  techLevel: SURefMetaCrawlerTechLevel | undefined
  /** The chosen crawler type, resolved. */
  selectedType: SURefCrawler | undefined
  /** Chosen systems resolved from the form's system ids. */
  systems: SURefSystem[]
  /** Number of SRD bays the crawler ships with (seeded automatically). */
  bayCount: number
  submitError: string | null
}

function KvRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-4 border-b border-wk-bg-2 py-2.5 last:border-0">
      <span
        className={cn(
          LAYOUT.reviewLabelRail,
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

/**
 * Review (Union Crawler pp.212–213 + wizard-refresh Phase 5): kv-panel recap
 * of type / ability / weapon(s) / stat block / scrap pool / crew on the left;
 * the chosen type and weapon entity cards stacked on the right (the universal
 * entity-card rule — fresh weapons carry an 'Intact' badge). Structure Points
 * render through the derived-at-read arithmetic (`20 + 5 type bonus = 25` for
 * Battle). The Augmented type re-surfaces its +1 Training Point reminder —
 * TEXT ONLY, never a cross-pilot write (ADR-007).
 */
export function CrawlerReviewStep({
  form,
  techLevel,
  selectedType,
  systems,
  bayCount,
  submitError,
}: CrawlerReviewStepProps) {
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
