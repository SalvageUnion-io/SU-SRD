import { Btn, Field, Input } from 'suref-react'
import type { CrawlerWizardFormState, ScrapPoolForm } from '../../lib/wizard/crawlerFormState'
import { IdentityField } from '../sheet/IdentityField'
import { rollCrawlerName } from './crawlerRollTables'
import type { CrawlerRollTableDeps } from './crawlerRollTables'

const SCRAP_BUCKETS = ['tl1', 'tl2', 'tl3', 'tl4', 'tl5', 'tl6'] as const

type CrawlerIdentityStepProps = {
  name: string
  description: string
  scrapPool: ScrapPoolForm
  onChange: (patch: Partial<CrawlerWizardFormState>) => void
  /** Injectable roll deps for testing. */
  _rollDeps?: CrawlerRollTableDeps
}

function parseCount(raw: string): number {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/**
 * Step 5 · Name your Crawler (Union Crawler p.212): the sheets' IdentityField
 * idiom (the wizard previews exactly the live sheet) with a d20 Crawler Names
 * Table assist (p.226) — the roll writes into the field and stays editable.
 * The Scrap Pool relocates here (wizard-refresh Phase 5): an explicit,
 * OPTIONAL numeric input — the manual landing spot for the group's banked
 * Scrap, including whatever Pilots didn't spend on their Mechs (the mech
 * wizard's banking callout is text-only; this is where the number lands).
 * The Upgrade Pool input is REMOVED — it is fixed at 0 at creation.
 */
export function CrawlerIdentityStep({
  name,
  description,
  scrapPool,
  onChange,
  _rollDeps,
}: CrawlerIdentityStepProps) {
  function handleRoll() {
    const result = rollCrawlerName(_rollDeps)
    if (result !== null) onChange({ name: result })
  }

  return (
    <div className="max-w-3xl space-y-5">
      <IdentityField
        label="Crawler Name"
        value={name}
        editing
        onSave={(next) => onChange({ name: next })}
        placeholder="e.g. Crawler #132, aka ‘Tin Lizzy’"
        labelAction={
          <Btn size="sm" onClick={handleRoll} className="shrink-0">
            <span aria-hidden="true">⚄</span> Roll
          </Btn>
        }
      />

      <IdentityField
        label="Description"
        value={description}
        editing
        multiline
        onSave={(next) => onChange({ description: next })}
        placeholder="What the crawler is, its build and history."
      />

      <section className="space-y-4 rounded-[3px] border-chrome border-wk-faint p-4">
        <header>
          <h2 className="m-0 font-cond text-sm font-bold uppercase tracking-widest text-ink">
            Scrap Pool
          </h2>
          <p className="mt-0.5 font-body text-xs text-wk-muted">
            The group&rsquo;s banked Scrap, bucketed by tech level — including whatever your Pilots
            didn&rsquo;t spend crafting their Mechs. Optional; leave at 0 for a fresh start.
          </p>
        </header>

        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {SCRAP_BUCKETS.map((bucket, i) => {
            const id = `crawler-scrap-${bucket}`
            return (
              <Field key={bucket} label={`Scrap T${i + 1}`} htmlFor={id}>
                <Input
                  id={id}
                  type="number"
                  min={0}
                  value={scrapPool[bucket]}
                  onChange={(e) =>
                    onChange({
                      scrapPool: {
                        ...scrapPool,
                        [bucket]: parseCount(e.target.value),
                      },
                    })
                  }
                />
              </Field>
            )
          })}
        </div>
      </section>
    </div>
  )
}
