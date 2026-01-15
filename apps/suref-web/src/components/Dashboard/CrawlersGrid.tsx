import { CrawlerSmallDisplay } from './CrawlerSmallDisplay'
import { EntityGrid } from './EntityGrid'

export function CrawlersGrid() {
  return (
    <EntityGrid<'crawlers'>
      table="crawlers"
      title="Your Crawlers"
      createButtonLabel="New Crawler"
      createButtonBgColor="su.crawlerPink"
      createButtonColor="su.white"
      emptyStateMessage="No crawlers yet"
      renderCard={(crawler) => {
        return <CrawlerSmallDisplay key={crawler.id} id={crawler.id} />
      }}
    />
  )
}
