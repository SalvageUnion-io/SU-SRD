import { useCallback } from 'react'
import { SectionSeparator } from 'suref-react'
import { StatControl } from 'suref-react'
import type { CrawlerRow, CrawlerUpdate } from '../../types/common'

type CrawlerScrapStatsProps = {
  crawler: CrawlerRow
  readOnly: boolean
  onUpdate: (input: Partial<CrawlerUpdate>) => void
  /** Render as compact 2-column grid (for side-by-side layout) */
  compactGrid?: boolean
  compact?: boolean
  /** Optional callback to open the scrap conversion dialog */
  onOpenScrapConversion?: () => void
}

export function CrawlerScrapStats({
  crawler,
  readOnly,
  onUpdate,
  compactGrid,
  compact,
  onOpenScrapConversion,
}: CrawlerScrapStatsProps) {
  const handleChange = useCallback(
    (field: keyof CrawlerUpdate, newValue: number) => {
      if (readOnly) return
      onUpdate({ [field]: newValue })
    },
    [readOnly, onUpdate]
  )

  return (
    <div className="flex flex-col gap-2">
      <SectionSeparator label="Scrap" compact={compact} />
      <div
        className={
          compactGrid
            ? 'grid grid-cols-2 gap-3'
            : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'
        }
      >
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
      {onOpenScrapConversion && !readOnly && (
        <button
          type="button"
          onClick={onOpenScrapConversion}
          className="mt-1 w-full cursor-pointer rounded-md border border-su-grey-dark/30 bg-su-grey-light/30 px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-su-black/70 transition-colors hover:bg-su-grey-light/60"
        >
          Scrap Conversion
        </button>
      )}
    </div>
  )
}
