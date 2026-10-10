import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { NpcDesignerView } from '../../components/npc/NpcDesignerPage'
import { NpcDesignerPage } from '../../components/npc/NpcDesignerPage'
import { NewEntityScreen } from '../../components/wizard/NewEntityScreen'
import { pageTitle } from '../../lib/pageTitle'

type NpcsNewSearch = {
  view: NpcDesignerView
  crawler?: string
  slot?: string
}

/**
 * `/npcs/new` — the NPC designer (issue 1277, boards N1 and N2).
 *
 * `?view=any|crew` picks the mode (D8); crew takes `&crawler=<id>` and an
 * optional `&slot=<bayRef|type>`. The crawler sheet's Bays "Crew…" link lands
 * here. Always the guided designer: an NPC has no Blank door (D4).
 */
export const Route = createFileRoute('/npcs/new')({
  head: () => ({ meta: [{ title: pageTitle('Design an NPC') }] }),
  validateSearch: (search: Record<string, unknown>): NpcsNewSearch => ({
    view: search.view === 'crew' ? 'crew' : 'any',
    ...(typeof search.crawler === 'string' && search.crawler ? { crawler: search.crawler } : {}),
    ...(typeof search.slot === 'string' && search.slot ? { slot: search.slot } : {}),
  }),
  component: NpcsNewPage,
})

function NpcsNewPage() {
  const navigate = useNavigate()
  const { view, crawler, slot } = Route.useSearch()

  return (
    <NewEntityScreen
      kind="npc"
      mode="guided"
      wizard={
        <NpcDesignerPage
          view={view}
          crawlerId={crawler}
          slot={slot}
          onViewChange={(next) =>
            void navigate({
              to: '/npcs/new',
              search:
                next === 'crew' ? { view: next, ...(crawler ? { crawler } : {}) } : { view: next },
              replace: true,
            })
          }
          onCrewSelect={(next) =>
            void navigate({
              to: '/npcs/new',
              search: {
                view: 'crew',
                ...(next.crawler ? { crawler: next.crawler } : {}),
                ...(next.slot ? { slot: next.slot } : {}),
              },
              replace: true,
            })
          }
          onCreated={(id) => void navigate({ to: '/sheet/$kind/$id', params: { kind: 'npc', id } })}
          onCancel={() => void navigate({ to: '/' })}
        />
      }
      onModeChange={() => undefined}
      onCreated={(id) => void navigate({ to: '/sheet/$kind/$id', params: { kind: 'npc', id } })}
    />
  )
}
