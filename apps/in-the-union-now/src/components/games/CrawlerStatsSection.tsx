import { useCallback } from 'react'
import { SectionSeparator, ValueDisplay } from 'suref-react'
import { computeCrawlerStatsFromTechLevel } from '../../lib/crawlerUtils'
import type { CrawlerRow, CrawlerUpdate } from '../../types/common'

type CrawlerStatsSectionProps = {
  crawler: CrawlerRow
  readOnly: boolean
  onUpdate: (input: Partial<CrawlerUpdate>) => void
}

export function CrawlerStatsSection({ crawler, readOnly, onUpdate }: CrawlerStatsSectionProps) {
  const tlStats = computeCrawlerStatsFromTechLevel(crawler.tech_level, crawler.crawler_ref)

  const handleStatChange = useCallback(
    (field: keyof CrawlerUpdate, delta: number) => {
      if (readOnly) return
      const current = crawler[field as keyof CrawlerRow] as number
      onUpdate({ [field]: Math.max(0, current + delta) })
    },
    [readOnly, crawler, onUpdate]
  )

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Statistics" fontSize="text-sm" />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatBlock
          label="SP"
          value={crawler.current_sp}
          max={crawler.max_sp}
          canEdit={!readOnly}
          onIncrement={() => handleStatChange('current_sp', 1)}
          onDecrement={() => handleStatChange('current_sp', -1)}
        />
        <div className="flex flex-col gap-0.5">
          <ValueDisplay label="Tech Level" value={crawler.tech_level} />
        </div>
        <div className="flex flex-col gap-0.5">
          <ValueDisplay label="Upkeep" value={crawler.upkeep} />
        </div>
        <div className="flex flex-col gap-0.5">
          <ValueDisplay
            label="Upgrade Pool"
            value={tlStats.upgrade_cost ? `${crawler.upgrade_pool}/${tlStats.upgrade_cost}` : 'Max'}
          />
        </div>
      </div>

      <SectionSeparator label="Scrap by Tech Level" fontSize="text-xs" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {([1, 2, 3, 4, 5, 6] as const).map((tl) => {
          const field = `scrap_tl${tl}` as keyof CrawlerRow
          return (
            <StatBlock
              key={tl}
              label={`TL${tl}`}
              value={crawler[field] as number}
              canEdit={!readOnly}
              onIncrement={() => handleStatChange(field as keyof CrawlerUpdate, 1)}
              onDecrement={() => handleStatChange(field as keyof CrawlerUpdate, -1)}
            />
          )
        })}
      </div>
    </div>
  )
}

type StatBlockProps = {
  label: string
  value: number
  max?: number
  canEdit: boolean
  onIncrement: () => void
  onDecrement: () => void
}

function StatBlock({ label, value, max, canEdit, onIncrement, onDecrement }: StatBlockProps) {
  return (
    <div className="flex items-center gap-1.5">
      {canEdit && (
        <button
          type="button"
          onClick={onDecrement}
          className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded bg-su-grey-dark/50 font-mono text-sm font-bold text-su-white/70 transition-colors hover:bg-su-rust/80 hover:text-su-white"
        >
          -
        </button>
      )}
      <ValueDisplay label={label} value={max !== undefined ? `${value}/${max}` : value} compact />
      {canEdit && (
        <button
          type="button"
          onClick={onIncrement}
          className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded bg-su-grey-dark/50 font-mono text-sm font-bold text-su-white/70 transition-colors hover:bg-su-green/80 hover:text-su-white"
        >
          +
        </button>
      )}
    </div>
  )
}
