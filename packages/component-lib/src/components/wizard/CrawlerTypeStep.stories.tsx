import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { CrawlerTypeDetail, CrawlerTypeOptionList, CrawlerTypeSelectStep } from './CrawlerTypeStep'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Crawler Type Step',
}

const types = SalvageUnionReference.Crawlers.all()

/** The whole step — option list + the selected type's detail. */
export const Default: Story = () => {
  const [selectedType, setSelectedType] = useState<string | null>(types[0]?.id ?? null)
  return (
    <div className="sheet--crawler bg-paper p-4">
      <CrawlerTypeSelectStep types={types} selectedType={selectedType} onSelect={setSelectedType} />
    </div>
  )
}

/** The two halves in isolation. */
export const Parts: Story = () => {
  const [selectedType, setSelectedType] = useState<string | null>(types[0]?.id ?? null)
  const selected = types.find((t) => t.id === selectedType)
  return (
    <div className="sheet--crawler flex flex-col gap-8 bg-paper p-4">
      <div>
        <Caption>CrawlerTypeOptionList</Caption>
        <CrawlerTypeOptionList
          types={types}
          selectedType={selectedType}
          onSelect={setSelectedType}
        />
      </div>
      <div>
        <Caption>CrawlerTypeDetail</Caption>
        <CrawlerTypeDetail selected={selected} />
      </div>
    </div>
  )
}
