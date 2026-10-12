import { tokens } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { CrawlerStatsStep } from './CrawlerStatsStep'

const FRAME: CSSProperties = { backgroundColor: tokens.color.paper, padding: tokens.space[16] }

export default {
  title: 'Compositions/Wizard/Crawler Stats Step',
}

/** The derived stat readout for the chosen crawler type + tech level. */
export const Default = () => (
  <div className="sheet--crawler" style={FRAME}>
    <Caption>CrawlerStatsStep</Caption>
    <CrawlerStatsStep
      techLevel={SalvageUnionReference.CrawlerTechLevels.all()[0]}
      selectedType={SalvageUnionReference.Crawlers.all()[0]}
    />
  </div>
)
