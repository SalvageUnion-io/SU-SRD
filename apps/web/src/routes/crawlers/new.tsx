import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { CrawlerWizard } from '../../build/crawler/CrawlerWizard'
import { NewEntityScreen } from '../../build/wizard/NewEntityScreen'
import { useWizardReturn } from '../../build/wizard/useWizardReturn'
import { areaTitle } from '../../lib/pageTitle'
import type { CreateMode } from '../../lib/wizard/createMode'
import { parseCreateMode } from '../../lib/wizard/createMode'
import { parseGameParam } from '../../lib/wizard/fromGame'
import { parseSlugParam, preselectedCrawlerType } from '../../lib/wizard/preselect'

export const Route = createFileRoute('/crawlers/new')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, 'New Crawler') }] }),
  // mode: absent → chooser · 'guided' → the wizard · 'blank' → blank dialog
  // type: a slug deep-linked from an SRD page's "Build with this" (`lib/wizard/preselect.ts`)
  // game: the Game it lands in, from that Game's page in Play (`lib/wizard/fromGame.ts`)
  validateSearch: (
    search: Record<string, unknown>
  ): { mode: CreateMode; game?: string | undefined; type?: string } => {
    const typeSlug = parseSlugParam(search.type)
    const game = parseGameParam(search.game)
    return {
      mode: parseCreateMode(search.mode),
      // Always set: the root keeps the raw query, so an invalid `game` must be overwritten.
      game,
      ...(typeSlug ? { type: typeSlug } : {}),
    }
  },
  // No loader: the wizard renders inside GameDataReady, whose preload('all')
  // is already the gate for every route, so a per-route preload list here was
  // pure repetition.
  component: CrawlersNewPage,
})

function CrawlersNewPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { mode } = search
  // Signing in from the gate comes back to this same URL, deep-link param and all.
  const returnTo = useLocation({ select: (location) => location.href })

  // Finishing or cancelling goes back to the page the build was started from:
  // the Game's page in Play (`?game=`), or the Training Bay.
  const handleComplete = useWizardReturn(search.game)
  const handleCancel = handleComplete

  return (
    <main>
      <NewEntityScreen
        kind="crawler"
        mode={mode}
        returnTo={returnTo}
        gameId={search.game}
        wizard={
          <CrawlerWizard
            onComplete={handleComplete}
            onCancel={handleCancel}
            gameId={search.game}
            preselectType={preselectedCrawlerType(search.type)}
            onOffRules={() =>
              void navigate({ to: '/crawlers/new', search: { mode: 'blank', game: search.game } })
            }
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
