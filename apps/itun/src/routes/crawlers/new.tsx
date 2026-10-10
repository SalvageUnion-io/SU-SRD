import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useReturnToContainer } from '../../components/container/useShowContainer'
import { CrawlerBuilder } from '../../components/crawler/CrawlerBuilder'
import { NewEntityScreen } from '../../components/wizard/NewEntityScreen'
import { pageTitle } from '../../lib/pageTitle'
import type { CreateMode } from '../../lib/wizard/createMode'
import { parseCreateMode } from '../../lib/wizard/createMode'

export const Route = createFileRoute('/crawlers/new')({
  head: () => ({ meta: [{ title: pageTitle('New Crawler') }] }),
  // mode: absent → chooser · 'guided' → the wizard · 'blank' → blank dialog
  validateSearch: (search: Record<string, unknown>): { mode: CreateMode } => ({
    mode: parseCreateMode(search.mode),
  }),
  // No loader: the wizard renders inside GameDataReady, whose preload('all')
  // is already the gate for every route, so a per-route preload list here was
  // pure repetition (audit AP-11).
  component: CrawlersNewPage,
})

function CrawlersNewPage() {
  const navigate = useNavigate()
  const { mode } = Route.useSearch()

  // Finishing or cancelling goes back to the page the build was started from:
  // a Game's own page, or Shelves.
  const handleComplete = useReturnToContainer()
  const handleCancel = handleComplete

  return (
    <main>
      <NewEntityScreen
        kind="crawler"
        mode={mode}
        wizard={
          <CrawlerBuilder
            onComplete={handleComplete}
            onCancel={handleCancel}
            onOffRules={() => void navigate({ to: '/crawlers/new', search: { mode: 'blank' } })}
          />
        }
        onModeChange={(next) => void navigate({ to: '/crawlers/new', search: { mode: next } })}
        onCreated={(id) =>
          void navigate({ to: '/sheet/$kind/$id', params: { kind: 'crawler', id } })
        }
      />
    </main>
  )
}
