import { tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { CrawlerTypeSelectStep } from './CrawlerTypeStep'

const FRAME: CSSProperties = { backgroundColor: tokens.color.paper, padding: tokens.space[16] }

export default {
  title: 'Compositions/Wizard/Crawler Type Step',
}

const types = SalvageUnionReference.Crawlers.all()

/**
 * The whole step — the radio pool of types plus the selected type's full card.
 */
export const Default = () => {
  const [selectedType, setSelectedType] = useState<string | null>(types[0]?.id ?? null)
  return (
    <div className="sheet--crawler" style={FRAME}>
      <CrawlerTypeSelectStep types={types} selectedType={selectedType} onSelect={setSelectedType} />
    </div>
  )
}
