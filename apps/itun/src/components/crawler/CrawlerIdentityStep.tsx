import { Button, Field, Input, Panel, Slab, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import type { CrawlerWizardFormState, ScrapPoolForm } from '../../lib/wizard/crawlerFormState'
import type { CrawlerRollTableDeps } from './crawlerRollTables'
import { rollCrawlerName } from './crawlerRollTables'
import '../../styles/wizard.css'

/** The step's column (`max-w-3xl`). */
const COLUMN: CSSProperties = { maxWidth: '48rem' }

/** The Roll button keeps its width beside the field label. */
const NO_SHRINK: CSSProperties = { flexShrink: 0 }

/** The Scrap Pool's hint under its Slab. */
const SCRAP_HINT: CSSProperties = {
  margin: `${tokens.space[2]} 0 0`,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
  color: tokens.color.wkMuted,
}

/** The bucket inputs; the column count is `.wiz-scrap-grid`. */
const SCRAP_GRID: CSSProperties = { display: 'grid', gap: tokens.space[12] }

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
 * The Scrap Pool relocates here: an explicit,
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
    <div className="wiz-stack wiz-stack--20" style={COLUMN}>
      <Field
        label="Crawler Name"
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

      <Panel soft className="wiz-stack wiz-stack--16 wiz-scrap-panel">
        <header>
          <Slab label="Scrap Pool" />
          <p style={SCRAP_HINT}>
            The group&rsquo;s banked Scrap, bucketed by tech level — including whatever your Pilots
            didn&rsquo;t spend crafting their Mechs. Optional; leave at 0 for a fresh start.
          </p>
        </header>

        <div className="wiz-scrap-grid" style={SCRAP_GRID}>
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
      </Panel>
    </div>
  )
}
