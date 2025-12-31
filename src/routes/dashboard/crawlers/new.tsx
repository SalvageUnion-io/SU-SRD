import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const CrawlerWizard = lazy(() =>
  import('../../../components/CrawlerWizard').then((m) => ({ default: m.CrawlerWizard }))
)

export const Route = createFileRoute('/dashboard/crawlers/new')({
  component: CrawlerWizard,
  staticData: {
    ssr: false,
  },
})
