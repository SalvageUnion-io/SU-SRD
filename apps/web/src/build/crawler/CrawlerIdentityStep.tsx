import type { CSSProperties } from 'react'
import { useId } from 'react'
import type { CrawlerWizardFormState, ScrapPoolForm } from '../../lib/wizard/crawlerFormState'
import { Button, Field, Input, Slab, tokens } from '../../components/index'
import type { CrawlerRollTableDeps } from './crawlerRollTables.model'
import { rollCrawlerName } from './crawlerRollTables.model'
import '../../styles/build/wizard.css'

/** The step's column, capped at 48rem. */
const COLUMN = { maxWidth: '48rem' } satisfies CSSProperties

/** The Roll button keeps its width beside the field label. */
const NO_SHRINK = { flexShrink: 0 } satisfies CSSProperties

/** The Scrap Pool's Slab, close over its hint. */
const SCRAP_SLAB = { marginBottom: tokens.space[6] } satisfies CSSProperties

/** The Scrap Pool's hint, above its buckets. */
const SCRAP_HINT = {
  margin: `0 0 ${tokens.space[12]}`,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
  color: tokens.color.wkMuted,
} satisfies CSSProperties

/** The bucket inputs; the column count is `.su-wiz-scrap-grid`. */
const SCRAP_GRID = { display: 'grid', gap: tokens.space[12] } satisfies CSSProperties

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
 * The Scrap Pool relocates here, a section of the step under its Slab (no
 * titled box, ruleset N5): an explicit, OPTIONAL numeric input — the manual
 * landing spot for the group's banked Scrap, including whatever Pilots didn't
 * spend on their Mechs (the mech wizard's banking callout is text-only; this
 * is where the number lands).
 * The Upgrade Pool input is REMOVED — it is fixed at 0 at creation.
 */
export function CrawlerIdentityStep({
  name,
  description,
  scrapPool,
  onChange,
  _rollDeps,
}: CrawlerIdentityStepProps) {
  const scrapId = useId()
  function handleRoll() {
    const result = rollCrawlerName(_rollDeps)
    if (result !== null) onChange({ name: result })
  }

  return (
    <div className="su-wiz-stack su-wiz-stack--20" style={COLUMN}>
      <Field
        label="Crawler name"
        value={name}
        onSave={(next) => onChange({ name: next })}
        placeholder="e.g. Crawler #132, aka ‘Tin Lizzy’"
        labelAction={
          <Button size="compact" glyph="⚄" onClick={handleRoll} style={NO_SHRINK}>
            Roll
          </Button>
        }
      />

      <Field
        label="Description"
        value={description}
        multiline
        onSave={(next) => onChange({ description: next })}
        placeholder="What the crawler is, its build and history."
      />

      <section aria-labelledby={scrapId}>
        <Slab variant="solid" label="Scrap Pool" id={scrapId} style={SCRAP_SLAB} />
        <p style={SCRAP_HINT}>
          The group&rsquo;s banked Scrap, bucketed by tech level — including whatever your Pilots
          didn&rsquo;t spend crafting their Mechs. Optional; leave at 0 for a fresh start.
        </p>

        <div className="su-wiz-scrap-grid" style={SCRAP_GRID}>
          {SCRAP_BUCKETS.map((bucket, i) => {
            const id = `crawler-scrap-${bucket}`
            return (
              <Field key={bucket} label={`Scrap T${i + 1}`} htmlFor={id}>
                <Input
                  id={id}
                  type="number"
                  numeric
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
