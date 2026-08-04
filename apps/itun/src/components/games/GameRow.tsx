import { EntityRow } from 'component-lib'
import type { EntityRowStat } from 'component-lib'

import type { Id } from '../../../convex/_generated/dataModel'
import { AppLink } from '../shared/AppLink'

/**
 * A Game, listed the way a pilot, mech, or crawler is listed on the Roster.
 *
 * A Game is not game data, so it does not render through `ReferenceEntityDisplay`
 * — but it *is* another thing you own and open, so it gets the same `EntityRow`
 * the player entities use, with its own blue ontology tone (ADR-030).
 *
 * Deleting is deliberately absent. `games.destroy` ends a shared campaign for
 * everyone in it, which needs a confirm that names what is being destroyed —
 * that lives on the Game's own screen, not behind a trash icon in a list.
 */
export type GameRowGame = {
  _id: Id<'games'>
  name: string
  templateOrigin: string | undefined
  mediator: boolean
  organizer: boolean
  memberCount: number
  crawlerName: string | null
  pilotCount: number
  mechCount: number
}

/**
 * What the table IS, as `label | value` stats in the header band.
 *
 * These answer "what is this table" before you open it: which crawler the crew
 * rides, how much is built, who you are at it, and how many of you there are.
 *
 * They were body badges (`#430 Tenacity`, `4 Pilots`, `3 Mechs`) over a caption
 * that joined the rest with ' · ' separators — `Mediator · Organizer · 4
 * members · from the starter-set template`. Both are the vocabulary the entity
 * rows left behind: a count is a `label | value` fact, and a separator-joined
 * run is several facts wearing one chip. The band states them the way every
 * other row now does.
 *
 * A brand-new Game reads `CRAWLER | None` rather than dropping the stat: a row
 * with nothing beside the name looks broken rather than empty.
 */
function statsOf(game: GameRowGame): EntityRowStat[] {
  const stats: EntityRowStat[] = [
    { label: 'Crawler', value: game.crawlerName ?? 'None' },
    { label: 'Pilots', value: game.pilotCount },
    { label: 'Mechs', value: game.mechCount },
    // Your standing at the table, not a count — but still one label, one value.
    { label: 'Role', value: game.mediator ? 'Mediator' : game.organizer ? 'Organizer' : 'Player' },
    { label: 'Members', value: game.memberCount },
  ]
  // Provenance is only worth a cell when there IS a template behind the game.
  if (game.templateOrigin !== undefined) {
    stats.push({ label: 'From', value: `${game.templateOrigin} template` })
  }
  return stats
}

export function GameRow({ game }: { game: GameRowGame }) {
  return (
    <EntityRow
      entityType="game"
      name={game.name}
      sheetHref={`/games/${game._id}`}
      linkAs={AppLink}
      stats={statsOf(game)}
    />
  )
}
