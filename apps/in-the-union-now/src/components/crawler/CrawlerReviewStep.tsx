import type { SURefEntity, SURefMetaCrawlerTechLevel, SURefSystem } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'
import type { CrawlerWizardFormState } from '../../lib/wizard/crawlerFormState'
import { toScrapPoolPatch } from '../../lib/wizard/crawlerFormState'

type CrawlerReviewStepProps = {
  form: CrawlerWizardFormState
  /** Resolved tech-level entity for the form's chosen level. */
  techLevel: SURefMetaCrawlerTechLevel | undefined
  /** Chosen systems resolved from the form's system ids. */
  systems: SURefSystem[]
  /** Number of SRD bays the crawler ships with (seeded automatically). */
  bayCount: number
  submitError: string | null
}

function KvRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-4 border-b border-wk-bg-2 py-2.5 last:border-0">
      <span className="w-[120px] shrink-0 font-cond text-xs font-bold uppercase tracking-[0.1em] text-wk-muted">
        {label}
      </span>
      <span className={value ? 'font-body text-sm text-ink' : 'text-rust'}>
        {value ?? 'required'}
      </span>
    </div>
  )
}

/**
 * Review step (design §3.2 Review): kv-panel of the build's fields on the
 * left, the chosen system cards stacked on the right (fresh systems carry an
 * 'Intact' status badge).
 */
export function CrawlerReviewStep({
  form,
  techLevel,
  systems,
  bayCount,
  submitError,
}: CrawlerReviewStepProps) {
  const scrap = toScrapPoolPatch(form.scrapPool)
  const scrapSummary = Object.entries(scrap)
    .map(([bucket, qty]) => `T${bucket.slice(2)} ×${qty}`)
    .join(' · ')

  const rows: [string, string | null][] = [
    ['Name', form.name.trim() || null],
    ['Crawler', techLevel ? `${techLevel.name} · Tech Level ${techLevel.techLevel}` : null],
    ['Structure', techLevel ? `${techLevel.structurePoints} SP (starts at full)` : null],
    ['Bays', `Full SRD set · ${bayCount} bays, seeded automatically`],
    ['Systems', systems.length > 0 ? systems.map((s) => s.name).join(', ') : 'none'],
    ['Scrap Pool', scrapSummary || '—'],
    ['Upgrade Pool', form.upgradePool > 0 ? String(form.upgradePool) : '—'],
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* kv-panel */}
      <div className="self-start rounded-[3px] border-[1.5px] border-ink bg-paper p-4 text-sm">
        {rows.map(([k, v]) => (
          <KvRow key={k} label={k} value={v} />
        ))}
        {submitError && (
          <p role="alert" className="mt-3 text-sm text-rust">
            {submitError}
          </p>
        )}
      </div>

      {/* chosen cards */}
      <div className="space-y-3">
        {systems.map((system) => (
          <ReferenceEntityDisplay
            key={system.id}
            data={system as unknown as SURefEntity}
            compact
            status="intact"
            hide={{ actions: true, choices: true }}
          />
        ))}
        {systems.length === 0 && <p className="text-sm text-wk-muted">No systems chosen.</p>}
      </div>
    </div>
  )
}
