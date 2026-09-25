import { Caption } from 'component-lib/stories/harness'
import { SalvageUnionReference } from 'salvageunion-reference'
import { CrawlerStatsStep } from './CrawlerStatsStep'

export default {
  title: 'Compositions/Wizard/Crawler Stats Step',
}

/** The derived stat readout for the chosen crawler type + tech level. */
export const Default = () => (
  <div className="sheet--crawler bg-paper p-4">
    <Caption>CrawlerStatsStep</Caption>
    <CrawlerStatsStep
      techLevel={SalvageUnionReference.CrawlerTechLevels.all()[0]}
      selectedType={SalvageUnionReference.Crawlers.all()[0]}
    />
  </div>
)
