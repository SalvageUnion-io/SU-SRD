import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const CrawlerEdit = lazy(() =>
  import('../../../components/Dashboard/CrawlerEdit').then((m) => ({ default: m.CrawlerEdit }))
)

export const Route = createFileRoute('/dashboard/crawlers/$id')({
  component: CrawlerEdit,
  staticData: {
    ssr: false,
  },
})
