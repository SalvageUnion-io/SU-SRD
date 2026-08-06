import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { CrawlerTypeSelectStep } from './CrawlerTypeStep'

export default {
  title: 'Compositions/Wizard/Crawler Type Step',
}

const types = SalvageUnionReference.Crawlers.all()

/**
 * The whole step — the radio pool of types plus the selected type's full card.
 *
 * The former `Parts` story demonstrated `CrawlerTypeOptionList` /
 * `CrawlerTypeDetail`, the master/detail pair the live sheet's Change Crawler
 * Type modal used to render. That modal now runs the shared `EntitySearcher`,
 * which left the pair importable only from here — so they were deleted rather
 * than kept alive by the catalog.
 */
export const Default: Story = () => {
  const [selectedType, setSelectedType] = useState<string | null>(types[0]?.id ?? null)
  return (
    <div className="sheet--crawler bg-paper p-4">
      <CrawlerTypeSelectStep types={types} selectedType={selectedType} onSelect={setSelectedType} />
    </div>
  )
}
