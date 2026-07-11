import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { CrawlerBuilder } from '../../components/crawler/CrawlerBuilder'
import { NewEntityScreen } from '../../components/wizard/NewEntityScreen'
import { parseCreateMode } from '../../lib/wizard/createMode'
import type { CreateMode } from '../../lib/wizard/createMode'

export const Route = createFileRoute('/crawlers/new')({
  // mode: absent → chooser · 'guided' → the wizard · 'blank' → blank dialog
  validateSearch: (search: Record<string, unknown>): { mode: CreateMode } => ({
    mode: parseCreateMode(search.mode),
  }),
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
        wizard={<CrawlerBuilder onComplete={handleComplete} onCancel={handleCancel} />}
        onModeChange={(next) => void navigate({ to: '/crawlers/new', search: { mode: next } })}
        onCreated={(id) =>
          void navigate({ to: '/sheet/$kind/$id', params: { kind: 'crawler', id } })
        }
      />
    </main>
  )
}
