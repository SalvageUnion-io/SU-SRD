import { createFileRoute } from '@tanstack/react-router'
import { CrawlerWizard } from '../../build/crawler/CrawlerWizard'
import { NewUnitRoute } from '../../build/wizard/NewUnitRoute'
import { newUnitHead, newUnitSearch } from '../../lib/newUnitRoute'
import { preselectedCrawlerType } from '../../lib/wizard/preselect'

export const Route = createFileRoute('/crawlers/new')({
  head: () => newUnitHead('New Crawler'),
  validateSearch: (search: Record<string, unknown>) => newUnitSearch(search, 'type'),
  component: CrawlersNewPage,
})

function CrawlersNewPage() {
  const search = Route.useSearch()
  return (
    <NewUnitRoute
      kind="crawler"
      search={search}
      wizard={(props) => (
        <CrawlerWizard {...props} preselectType={preselectedCrawlerType(search.type)} />
      )}
    />
  )
}
