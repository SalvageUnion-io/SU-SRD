import { EntityRow } from 'component-lib'

import type { Id } from '../../../convex/_generated/dataModel'
import { AppLink } from '../shared/AppLink'

/**
 * A Game, listed the way a pilot, mech, or crawler is listed on the Roster.
 *
 * A Game is not game data, so it does not render through `ReferenceEntityDisplay`
 * — but it *is* another thing you own and open, so it gets the same `EntityRow`
 * the player entities use, with its own blue ontology tone (ADR-030).
 *
 * The three badges answer "what is this table" before you open it: which
 * crawler the crew rides, and how much is built. A brand-new Game reads
 * "No crawler · 0 Pilots · 0 Mechs" rather than dropping the badges, because a
 * row with nothing under the name looks broken rather than empty.
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

/** Join the row's caption segments with the Roster's separator, dropping blanks. */
function captionOf(game: GameRowGame): string {
  const role = game.mediator ? 'Mediator' : 'Player'
  const segments = [
    game.organizer ? `${role} · Organizer` : role,
    `${game.memberCount} ${game.memberCount === 1 ? 'member' : 'members'}`,
    game.templateOrigin === undefined ? null : `from the ${game.templateOrigin} template`,
  ]
  return segments.filter((segment) => segment !== null).join(' · ')
}

export function GameRow({ game }: { game: GameRowGame }) {
  return (
    <EntityRow
      entityType="game"
      name={game.name}
      sheetHref={`/games/${game._id}`}
      linkAs={AppLink}
      meta={[
        game.crawlerName ?? 'No crawler',
        `${game.pilotCount} ${game.pilotCount === 1 ? 'Pilot' : 'Pilots'}`,
        `${game.mechCount} ${game.mechCount === 1 ? 'Mech' : 'Mechs'}`,
      ]}
      metaLine={captionOf(game)}
    />
  )
}
