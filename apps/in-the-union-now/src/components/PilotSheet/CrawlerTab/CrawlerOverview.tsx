import { Truck } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { getNameById } from 'salvageunion-reference'
import type { Crawler } from '../../../types/common'
import type { TechLevel } from 'suref-react'
import { TECH_LEVELS, SCRAP_CONVERSION_RATES } from 'suref-react'

type CrawlerOverviewProps = {
  crawler: Crawler | null
  crawlerId: string | null
}

export function CrawlerOverview({ crawler, crawlerId }: CrawlerOverviewProps) {
  if (!crawler && !crawlerId) {
    return (
      <div className="p-4 text-center">
        <Truck className="mx-auto mb-2 h-8 w-8 text-su-grey" />
        <p className="text-sm text-su-grey">No crawler assigned</p>
        <p className="mt-1 text-xs text-su-grey-dark">
          Assign this pilot to a crawler from the roster
        </p>
      </div>
    )
  }

  if (!crawler) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-su-grey">Loading crawler...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-crawler/20 text-crawler">
          <Truck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold">{crawler.name || 'Unnamed Crawler'}</h3>
          <div className="flex gap-3 text-xs text-su-grey-dark">
            {crawler.crawler_ref && <span>{getNameById('crawlers', crawler.crawler_ref)}</span>}
            <span>TL {crawler.tech_level}</span>
            <span>
              SP: {crawler.max_sp - crawler.current_damage}/{crawler.max_sp}
            </span>
          </div>
        </div>
        <Link
          to="/crawler/$id"
          params={{ id: crawler.id }}
          className="ml-auto text-xs text-crawler underline"
        >
          Manage
        </Link>
      </div>

      {/* Scrap storage */}
      <div>
        <h4 className="mb-2 text-sm font-bold text-crawler">Scrap Storage</h4>
        <div className="grid grid-cols-3 gap-2">
          {TECH_LEVELS.map((tl) => {
            const key = `scrap_tl${tl}` as keyof Crawler
            const amount = (crawler[key] as number) ?? 0
            return (
              <div
                key={tl}
                className="rounded-lg border border-[var(--border)] p-2 text-center text-xs"
              >
                <div className="font-bold">TL{tl}</div>
                <div className="text-lg font-bold">{amount}</div>
                <div className="text-su-grey-dark">
                  = {amount * SCRAP_CONVERSION_RATES[tl as TechLevel]} scrap
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Description */}
      {crawler.description && (
        <div>
          <h4 className="mb-1 text-sm font-bold text-crawler">Description</h4>
          <p className="text-xs text-su-grey-dark">{crawler.description}</p>
        </div>
      )}
    </div>
  )
}
