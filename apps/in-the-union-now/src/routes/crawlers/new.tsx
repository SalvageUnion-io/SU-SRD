import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { CrawlerBuilder } from '../../components/crawler/CrawlerBuilder'

export const Route = createFileRoute('/crawlers/new')({
  component: CrawlersNewPage,
})

function CrawlersNewPage() {
  const navigate = useNavigate()

  function handleCreated() {
    void navigate({ to: '/' })
  }

  function handleCancel() {
    void navigate({ to: '/' })
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">New Crawler</h1>
      <CrawlerBuilder onCreated={handleCreated} onCancel={handleCancel} />
    </main>
  )
}
