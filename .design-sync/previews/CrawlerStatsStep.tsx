/* Ported from packages/component-lib/src/components/wizard/CrawlerStatsStep.stories.tsx. */
import { CrawlerStatsStep } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

/** The derived stat readout for the chosen crawler type + tech level. */
export function Derived() {
  const techLevel = SalvageUnionReference.CrawlerTechLevels.all()[0]
  const selectedType = SalvageUnionReference.Crawlers.all()[0]
  return (
    <div className="sheet--crawler bg-paper p-4">
      <Caption>
        {selectedType?.name ?? 'Crawler'} at the first tech level
      </Caption>
      <CrawlerStatsStep techLevel={techLevel} selectedType={selectedType} />
    </div>
  )
}

/** A higher tech level — every derived stat moves with it. */
export function HigherTechLevel() {
  const levels = SalvageUnionReference.CrawlerTechLevels.all()
  const techLevel = levels[Math.min(3, levels.length - 1)]
  const selectedType = SalvageUnionReference.Crawlers.all()[0]
  return (
    <div className="sheet--crawler bg-paper p-4">
      <Caption>the same crawler, further up the tech ladder</Caption>
      <CrawlerStatsStep techLevel={techLevel} selectedType={selectedType} />
    </div>
  )
}
