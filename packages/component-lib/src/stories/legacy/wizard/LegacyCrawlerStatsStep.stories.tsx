/**
 * Legacy "before" capture — ITUN crawler wizard `CrawlerStatsStep`.
 *
 * Reproduces the presentational shell of
 * apps/in-the-union-now/src/components/crawler/CrawlerStatsStep.tsx VERBATIM
 * (lines 21-69): a `flex flex-wrap gap-4` row of shared `Stat` atoms over a
 * `max-w-[64ch]` prose block that renders the derived-at-read Structure Points
 * breakdown. The step is display-only — a new crawler is FIXED at Tech Level 1
 * (Hamlet Crawler). Driven with real `SalvageUnionReference` fixtures and the
 * real `crawlerMaxSPParts` rule. L1 reconciliation: freeze the "before".
 */

import type { Story } from '@ladle/react'
import type { SURefCrawler, SURefMetaCrawlerTechLevel } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { crawlerMaxSPParts } from 'salvageunion-reference/rules'
import { Stat } from 'component-lib'
import { Caption } from '../../_harness'

// Verbatim reproduction of CrawlerStatsStep.tsx (lines 21-69).
function CrawlerStatsStep({
  techLevel,
  selectedType,
}: {
  techLevel: SURefMetaCrawlerTechLevel | undefined
  selectedType: SURefCrawler | undefined
}) {
  if (!techLevel) {
    return (
      <p className="m-0 font-body text-sm text-current">
        Tech Level 1 statistics are loading — they appear here.
      </p>
    )
  }

  const sp = crawlerMaxSPParts({
    techLevel: `tech-${techLevel.techLevel}`,
    type: selectedType?.id,
  })

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap gap-4">
        <Stat label="TL" value={techLevel.techLevel} compact />
        <Stat label="SP" value={sp.total} max={sp.total} compact />
        <Stat label="UPKEEP" value={techLevel.upkeepCost ?? 0} compact />
        <Stat label="UPG" value={techLevel.upgradeCost ?? 0} compact />
        <Stat label="POOL" value={0} compact />
      </div>

      <div className="max-w-[64ch] space-y-1.5 font-body text-sm leading-relaxed text-current">
        {sp.typeBonus > 0 && selectedType ? (
          <p className="m-0" data-testid="sp-breakdown">
            Structure Points: {sp.base} + {sp.typeBonus} type bonus ({selectedType.name}) ={' '}
            <strong>{sp.total}</strong> — the bonus derives from your Crawler type, so it follows a
            type change automatically.
          </p>
        ) : (
          <p className="m-0" data-testid="sp-breakdown">
            Structure Points: <strong>{sp.total}</strong> — the {techLevel.name} base.
          </p>
        )}
        <p className="m-0">
          A new Crawler is a <strong>{techLevel.name}</strong>
          {typeof techLevel.populationMin === 'number' &&
          typeof techLevel.populationMax === 'number'
            ? ` — population ${techLevel.populationMin}–${techLevel.populationMax}`
            : ''}
          . The Upgrade Pool starts at 0 and fills during play; every Bay starts{' '}
          <strong>Intact</strong>.
        </p>
      </div>
    </div>
  )
}

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Crawler Stats Step' }

export const Default: Story = () => {
  const techLevel = SalvageUnionReference.CrawlerTechLevels.all().find((t) => t.techLevel === 1)
  const types = SalvageUnionReference.Crawlers.all()
  const battle = types.find((t) => t.name === 'Battle')

  if (!techLevel) {
    return <Caption>Tech Level 1 (Hamlet Crawler) fixture missing</Caption>
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Caption>
          CrawlerStatsStep — Battle type: the +5 type bonus surfaces in the SP breakdown
          (CrawlerStatsStep.tsx:21-69)
        </Caption>
        <CrawlerStatsStep techLevel={techLevel} selectedType={battle} />
      </div>

      <div>
        <Caption>CrawlerStatsStep — no type chosen: bare Hamlet Crawler base</Caption>
        <CrawlerStatsStep techLevel={techLevel} selectedType={undefined} />
      </div>
    </div>
  )
}
