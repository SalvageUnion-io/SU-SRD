import type { CSSProperties } from 'react'
import { useId } from 'react'
import { Field, Input, SlabSection, Text, tokens } from '../../components/index'
import type { CrawlerWizardFormState, ScrapPoolForm } from '../../lib/wizard/crawlerFormState'
import { crawlerCopy } from '../../messages/build-crawler'
import { RollTableButton } from '../wizard/RollTableButton'
import type { RollTableDeps } from '../wizard/rollTableHelpers.model'
import { CRAWLER_NAME_TABLE } from '../wizard/rollTableHelpers.model'
import '../../styles/build/wizard.css'

/** The step's column, capped at 48rem. */
const COLUMN = { maxWidth: '48rem' } satisfies CSSProperties

const SCRAP_HINT = { marginBottom: tokens.space[12] } satisfies CSSProperties

/** The bucket inputs; the column count is `.su-wiz-scrap-grid`. */
const SCRAP_GRID = { display: 'grid', gap: tokens.space[12] } satisfies CSSProperties

const SCRAP_BUCKETS = ['tl1', 'tl2', 'tl3', 'tl4', 'tl5', 'tl6'] as const

type CrawlerIdentityStepProps = {
  name: string
  description: string
  scrapPool: ScrapPoolForm
  onChange: (patch: Partial<CrawlerWizardFormState>) => void
  /** Injectable roll deps for testing. */
  _deps?: RollTableDeps
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
  _deps,
}: CrawlerIdentityStepProps) {
  const scrapId = useId()

  return (
    <div className="su-wiz-stack su-wiz-stack--20" style={COLUMN}>
      <Field
        label={crawlerCopy('crawlerName')}
        value={name}
        onSave={(next) => onChange({ name: next })}
        placeholder={crawlerCopy('eGCrawler132Aka')}
        labelAction={
          <RollTableButton
            table={CRAWLER_NAME_TABLE}
            onRoll={(next) => onChange({ name: next })}
            _deps={_deps}
          />
        }
      />

      <Field
        label={crawlerCopy('description')}
        value={description}
        multiline
        onSave={(next) => onChange({ description: next })}
        placeholder={crawlerCopy('whatTheCrawlerIsIts')}
      />

      <SlabSection title={crawlerCopy('scrapPool')} id={scrapId}>
        <Text variant="note" style={SCRAP_HINT}>
          {crawlerCopy('theGroupsBankedScrapBucketed')}
        </Text>

        <div className="su-wiz-scrap-grid" style={SCRAP_GRID}>
          {SCRAP_BUCKETS.map((bucket, i) => {
            const id = `crawler-scrap-${bucket}`
            return (
              <Field key={bucket} label={crawlerCopy('scrapT', { value: i + 1 })} htmlFor={id}>
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
      </SlabSection>
    </div>
  )
}
