import { useCallback } from 'react'
import { SectionSeparator } from 'suref-react'
import { StatControl } from '../shared/StatControl'
import type { CrawlerRow, CrawlerUpdate } from '../../types/common'

type CrawlerScrapStatsProps = {
  crawler: CrawlerRow
  readOnly: boolean
  onUpdate: (input: Partial<CrawlerUpdate>) => void
}

export function CrawlerScrapStats({ crawler, readOnly, onUpdate }: CrawlerScrapStatsProps) {
  const handleChange = useCallback(
    (field: keyof CrawlerUpdate, newValue: number) => {
      if (readOnly) return
      onUpdate({ [field]: newValue })
    },
    [readOnly, onUpdate]
  )

  return (
    <div className="flex flex-col gap-2">
      <SectionSeparator label="Scrap" fontSize="text-sm" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {([1, 2, 3, 4, 5, 6] as const).map((tl) => {
          const field = `scrap_tl${tl}` as keyof CrawlerUpdate
          const value = crawler[field as keyof CrawlerRow] as number
          return (
            <StatControl
              key={tl}
              label={`TL${tl}`}
              value={value}
              canEdit={!readOnly}
              onChange={(v) => handleChange(field, v)}
            />
          )
        })}
      </div>
    </div>
  )
}
