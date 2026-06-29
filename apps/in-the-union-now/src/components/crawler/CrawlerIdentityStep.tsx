import { Field, Input } from 'suref-react'
import type { CrawlerWizardFormState, ScrapPoolForm } from '../../lib/wizard/crawlerFormState'

const SCRAP_BUCKETS = ['tl1', 'tl2', 'tl3', 'tl4', 'tl5', 'tl6'] as const

type CrawlerIdentityStepProps = {
  name: string
  scrapPool: ScrapPoolForm
  upgradePool: number
  onChange: (patch: Partial<CrawlerWizardFormState>) => void
}

function parseCount(raw: string): number {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/**
 * Identity step (design §3.2 Identity variant): max-w-760 form — Crawler Name
 * (required) plus the crawler's starting resources (plan: scrapPool /
 * upgradePool editable in identity where sensible). The shared scrap pool is
 * TL-bucketed (rules C5); the Upgrade Pool accumulates toward the next tech
 * level (rules C4).
 */
export function CrawlerIdentityStep({
  name,
  scrapPool,
  upgradePool,
  onChange,
}: CrawlerIdentityStepProps) {
  return (
    <div className="max-w-3xl space-y-5">
      <Field label="Crawler Name" required htmlFor="crawler-name">
        <Input
          id="crawler-name"
          type="text"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="The Wandering Throne"
          required
        />
      </Field>

      <section className="space-y-4 rounded-[3px] border-[1.5px] border-wk-faint p-4">
        <header>
          <h2 className="font-cond text-sm font-bold uppercase tracking-[0.1em] text-ink">
            Starting Resources
          </h2>
          <p className="mt-0.5 font-body text-xs text-wk-muted">
            The party&rsquo;s shared scrap pool, bucketed by tech level, plus any Upgrade Pool
            progress. Leave at 0 for a fresh crawler.
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

        <Field label="Upgrade Pool" htmlFor="crawler-upgrade-pool" className="max-w-[180px]">
          <Input
            id="crawler-upgrade-pool"
            type="number"
            min={0}
            value={upgradePool}
            onChange={(e) => onChange({ upgradePool: parseCount(e.target.value) })}
          />
        </Field>
      </section>
    </div>
  )
}
