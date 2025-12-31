import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const CrawlersGrid = lazy(() =>
  import('../../../components/Dashboard/CrawlersGrid').then((m) => ({ default: m.CrawlersGrid }))
)

export const Route = createFileRoute('/dashboard/crawlers/')({
  component: CrawlersGrid,
  staticData: {
    ssr: false,
  },
})
