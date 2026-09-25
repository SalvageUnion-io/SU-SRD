import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CrawlerBuilder } from '../../components/crawler/CrawlerBuilder'
import { NewEntityScreen } from '../../components/wizard/NewEntityScreen'
import type { CreateMode } from '../../lib/wizard/createMode'
import { parseCreateMode } from '../../lib/wizard/createMode'

export const Route = createFileRoute('/crawlers/new')({
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

  function handleComplete() {
    void navigate({ to: '/' })
  }

  function handleCancel() {
    void navigate({ to: '/' })
  }

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
