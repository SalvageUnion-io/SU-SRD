import { Link } from '@tanstack/react-router'
import { Truck } from 'lucide-react'
import { getNameById } from 'salvageunion-reference'
import type { Crawler } from '../../types/common'

type CrawlerCardProps = {
  crawler: Crawler
}

export function CrawlerCard({ crawler }: CrawlerCardProps) {
  return (
    <Link
      to="/crawler/$id"
      params={{ id: crawler.id }}
      className="group block rounded-xl border-2 border-crawler/30 bg-[var(--card)] p-4 transition-all hover:border-crawler hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-crawler/20 text-crawler">
          <Truck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold leading-tight">{crawler.name || 'Unnamed Crawler'}</h3>
          {crawler.crawler_ref && (
            <p className="text-xs text-su-grey-dark">
              {getNameById('crawlers', crawler.crawler_ref)}
            </p>
          )}
          <div className="mt-2 flex gap-4 text-xs">
            <span>
              TL: <span className="font-bold">{crawler.tech_level}</span>
            </span>
            <span>
              SP:{' '}
              <span className="font-bold">
                {crawler.max_sp - crawler.current_damage}/{crawler.max_sp}
              </span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
