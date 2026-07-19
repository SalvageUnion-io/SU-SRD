import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'

import { CrawlerBuilder } from '../../components/crawler/CrawlerBuilder'
import { NewEntityScreen } from '../../components/wizard/NewEntityScreen'
import { parseCreateMode } from '../../lib/wizard/createMode'
import type { CreateMode } from '../../lib/wizard/createMode'

export const Route = createFileRoute('/crawlers/new')({
  // mode: absent → chooser · 'guided' → the wizard · 'blank' → blank dialog
  validateSearch: (search: Record<string, unknown>): { mode: CreateMode } => ({
    mode: parseCreateMode(search.mode),
  }),
  loader: async () => {
    // Preload game data needed by the wizard before rendering (parity with
    // pilots/mechs — plan §4.3): crawlers for the type cards + mutations
    // budgets, crawler-tech-levels for the Statistics step + SP derivation,
    // systems/actions/traits for the weapons entity cards + isWeaponSystem,
    // crawler-bays for the seeded set + Crew roster, roll-tables for the
    // Crawler Name d20 assist.
    await SalvageUnionReference.preload([
      'crawlers',
      'crawler-tech-levels',
      'systems',
      'crawler-bays',
      'actions',
      'traits',
      'roll-tables',
    ])
    return null
  },
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
