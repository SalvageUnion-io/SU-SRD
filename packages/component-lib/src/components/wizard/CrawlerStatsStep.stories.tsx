import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { CrawlerStatsStep } from './CrawlerStatsStep'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Wizard/Crawler Stats Step',
}

/** The derived stat readout for the chosen crawler type + tech level. */
export const Default: Story = () => (
  <div className="sheet--crawler bg-paper p-4">
    <Caption>CrawlerStatsStep</Caption>
    <CrawlerStatsStep
      techLevel={SalvageUnionReference.CrawlerTechLevels.all()[0]}
      selectedType={SalvageUnionReference.Crawlers.all()[0]}
    />
  </div>
)
