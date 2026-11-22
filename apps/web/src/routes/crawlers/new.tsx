import { createFileRoute } from '@tanstack/react-router'
import { CrawlerWizard } from '../../build/crawler/CrawlerWizard'
import { NewUnitRoute } from '../../build/wizard/NewUnitRoute'
import type { NewUnitSearch } from '../../lib/newUnitRoute'
import { newUnitHead, newUnitSearch } from '../../lib/newUnitRoute'
import { parseGameParam } from '../../lib/wizard/fromGame'
import { preselectedCrawlerType } from '../../lib/wizard/preselect'
import { routesCopy } from '../../messages/routes'

export const Route = createFileRoute('/crawlers/new')({
  head: () => newUnitHead(routesCopy('newCrawler')),
  // pilot, mech: the unit whose "+ Create" it was made from; it and its pair are assigned (r4 E19)
  validateSearch: (search: Record<string, unknown>): NewUnitSearch<'type'> => ({
    ...newUnitSearch(search, 'type'),
    pilot: parseGameParam(search.pilot),
    mech: parseGameParam(search.mech),
  }),
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
