import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { CrawlerBuilder } from '../../components/crawler/CrawlerBuilder'

export const Route = createFileRoute('/crawlers/new')({
  component: CrawlersNewPage,
})

function CrawlersNewPage() {
  const navigate = useNavigate()

  function handleComplete() {
    void navigate({ to: '/' })
  }

  function handleCancel() {
    void navigate({ to: '/' })
  }

  return (
    <main>
      <CrawlerBuilder onComplete={handleComplete} onCancel={handleCancel} />
    </main>
  )
}
