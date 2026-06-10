/**
 * /crawlers/$id/edit — crawler edit entry route (plan 3.1).
 *
 * Reuses the CrawlerBuilder in edit mode: the stored crawler maps onto wizard
 * form state via crawlerToFormState, and handleSubmit takes the update branch
 * (no duplicate create). The `$id_` segment opts out of nesting under the
 * /crawlers/$id detail route.
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { CrawlerBuilder } from '../../components/crawler/CrawlerBuilder'
import { crawlerToFormState } from '../../lib/wizard/crawlerFormState'
import { useEntityStore } from '../../stores/entityStore'

export const Route = createFileRoute('/crawlers/$id_/edit')({
  loader: async ({ params }) => {
    await useEntityStore.getState().hydrate('crawler')
    return { id: params.id }
  },
  component: EditCrawlerRoute,
})

function EditCrawlerRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  const crawler = useEntityStore((s) => s.crawlers.find((c) => c.id === id) ?? null)

  if (!crawler) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-muted-foreground">Crawler not found.</p>
        <Link to="/" className="text-sm underline">
          Back to dashboard
        </Link>
      </main>
    )
  }

  function handleComplete(crawlerId: string) {
    void navigate({ to: '/crawlers/$id', params: { id: crawlerId } })
  }

  function handleCancel() {
    void navigate({ to: '/crawlers/$id', params: { id } })
  }

  return (
    <main className="min-h-dvh bg-background">
      <CrawlerBuilder
        key={crawler.id}
        crawlerId={crawler.id}
        initialState={crawlerToFormState(crawler)}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </main>
  )
}
