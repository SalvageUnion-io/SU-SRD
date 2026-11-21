import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { NpcDesignerView } from '../../build/npc/NpcDesignerPage'
import { NpcDesignerPage } from '../../build/npc/NpcDesignerPage'
import { NewEntityScreen } from '../../build/wizard/NewEntityScreen'
import { isDenizenKind } from '../../lib/npcs/npcModel'
import { areaTitle } from '../../lib/pageTitle'
import { parseGameParam } from '../../lib/wizard/fromGame'
import { routesCopy } from '../../messages/routes'
import { gamePrepPath } from '../../play/games/prep/gamePrep.model'

type NpcsNewSearch = {
  view: NpcDesignerView
  crawler?: string
  slot?: string
  /** `&from=<schema>:<slug>`: the Reference denizen to design from. */
  from?: string
  /** `&game=<id>`: the Game whose Prep it is designed from; the NPC is made there. */
  game?: string
}

/**
 * `/npcs/new` — the NPC designer.
 *
 * `?view=any|crew` picks the mode (D8); crew takes `&crawler=<id>` and an
 * optional `&slot=<bayRef|type>`. The crawler sheet's Bays "Crew…" link lands
 * here. Always the guided designer: an NPC has no Blank door (D4).
 */
export const Route = createFileRoute('/npcs/new')({
  head: () => ({
    meta: [{ title: areaTitle(routesCopy('mediatorsKit'), routesCopy('designAnNpc')) }],
  }),
  validateSearch: (search: Record<string, unknown>): NpcsNewSearch => ({
    view: search.view === 'crew' ? 'crew' : 'any',
    ...(typeof search.crawler === 'string' && search.crawler ? { crawler: search.crawler } : {}),
    ...(typeof search.slot === 'string' && search.slot ? { slot: search.slot } : {}),
    ...(typeof search.from === 'string' && search.from ? { from: search.from } : {}),
    ...(parseGameParam(search.game) ? { game: parseGameParam(search.game) } : {}),
  }),
  component: NpcsNewPage,
})

function NpcsNewPage() {
  const navigate = useNavigate()
  const { view, crawler, slot, from, game } = Route.useSearch()
  // Kept through the designer's own navigation, so the NPC still lands in its Game.
  const inGame = game ? { game } : {}
  const [fromSchema, fromSlug] = (from ?? '').split(':')
  const startFrom =
    fromSchema && fromSlug && isDenizenKind(fromSchema)
      ? { schema: fromSchema, slug: fromSlug }
      : undefined

  return (
    <NewEntityScreen
      kind="npc"
      mode="guided"
      wizard={
        <NpcDesignerPage
          view={view}
          crawlerId={crawler}
          slot={slot}
          from={startFrom}
          gameId={game}
          onViewChange={(next) =>
            void navigate({
              to: '/npcs/new',
              search:
                next === 'crew'
                  ? { view: next, ...(crawler ? { crawler } : {}), ...inGame }
                  : { view: next, ...inGame },
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
                ...inGame,
              },
              replace: true,
            })
          }
          onCreated={(id) => void navigate({ to: '/npcs/$id', params: { id } })}
          // From a Game's Prep, cancelling goes back there.
          onCancel={() => void navigate({ to: game ? gamePrepPath(game) : '/' })}
        />
      }
      onModeChange={() => undefined}
      onCreated={(id) => void navigate({ to: '/npcs/$id', params: { id } })}
    />
  )
}
