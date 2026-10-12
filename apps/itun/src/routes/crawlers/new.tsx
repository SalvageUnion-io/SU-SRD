import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { useReturnToContainer } from '../../components/container/useShowContainer'
import { CrawlerBuilder } from '../../components/crawler/CrawlerBuilder'
import { NewEntityScreen } from '../../components/wizard/NewEntityScreen'
import { pageTitle } from '../../lib/pageTitle'
import type { CreateMode } from '../../lib/wizard/createMode'
import { parseCreateMode } from '../../lib/wizard/createMode'
import { parseSlugParam, preselectedCrawlerType } from '../../lib/wizard/preselect'

export const Route = createFileRoute('/crawlers/new')({
  head: () => ({ meta: [{ title: pageTitle('New Crawler') }] }),
  // mode: absent → chooser · 'guided' → the wizard · 'blank' → blank dialog
  // type: a slug deep-linked from an SRD page's "Build with this" (`lib/wizard/preselect.ts`)
  validateSearch: (search: Record<string, unknown>): { mode: CreateMode; type?: string } => {
    const typeSlug = parseSlugParam(search.type)
    return { mode: parseCreateMode(search.mode), ...(typeSlug ? { type: typeSlug } : {}) }
  },
  // No loader: the wizard renders inside GameDataReady, whose preload('all')
  // is already the gate for every route, so a per-route preload list here was
  // pure repetition (audit AP-11).
  component: CrawlersNewPage,
})

function CrawlersNewPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { mode } = search
  // Signing in from the gate comes back to this same URL, deep-link param and all.
  const returnTo = useLocation({ select: (location) => location.href })

  // Finishing or cancelling goes back to the page the build was started from:
  // a Game's own page, or Shelves.
  const handleComplete = useReturnToContainer()
  const handleCancel = handleComplete

  return (
    <main>
      <NewEntityScreen
        kind="crawler"
        mode={mode}
        returnTo={returnTo}
        wizard={
          <CrawlerBuilder
            onComplete={handleComplete}
            onCancel={handleCancel}
            preselectType={preselectedCrawlerType(search.type)}
            onOffRules={() => void navigate({ to: '/crawlers/new', search: { mode: 'blank' } })}
          />
        }
        onModeChange={(next) =>
          void navigate({ to: '/crawlers/new', search: (prev) => ({ ...prev, mode: next }) })
        }
        onCreated={(id) =>
          void navigate({ to: '/sheet/$kind/$id', params: { kind: 'crawler', id } })
        }
      />
    </main>
  )
}
