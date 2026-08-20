import type { EntityRowStat } from 'component-lib'
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
 * Deleting rides the same trash affordance every other `EntityRow` uses, and is
 * passed in rather than wired here: `games.destroy` ends a shared campaign for
 * everyone in it, so it needs a confirm that names what is being destroyed, and
 * one dialog serving the whole list beats one mounted per row. The parent owns
 * that dialog; this row only reports the click.
 *
 * It is offered to the **Organizer alone** — the parent decides, by simply not
 * passing `onDelete`. That is a courtesy, not the boundary: `games.destroy`
 * calls `requireOrganizer` regardless of what the client chooses to draw.
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
 * What the TABLE is — the band's register, scanned down the column.
 *
 * Which crawler the crew rides, and how much is built. A brand-new Game reads
 * `CRAWLER | None` rather than dropping the stat: a row with nothing beside its
 * name looks broken rather than new.
 */
function tableStats(game: GameRowGame): EntityRowStat[] {
  return [
    { label: 'Crawler', value: game.crawlerName ?? 'None' },
    { label: 'Pilots', value: game.pilotCount },
    { label: 'Mechs', value: game.mechCount },
  ]
}

/**
 * What YOU are at the table — the body's register, beside the controls.
 *
 * Your role, the size of the crew, and where the game came from. These are
 * facts about the row, but not what a reader scans a list of games FOR: you
 * scan for which table, and how much is on it. All six cells briefly sat in the
 * band together, which made the one line meant to be scanned the longest line
 * on the row.
 *
 * They were a single caption chip joining the lot with ' · ' separators —
 * `Mediator · Organizer · 4 members · from the starter-set template` — which is
 * several facts wearing one chip.
 */
function standingStats(game: GameRowGame): EntityRowStat[] {
  const stats: EntityRowStat[] = [
    { label: 'Role', value: game.mediator ? 'Mediator' : game.organizer ? 'Organizer' : 'Player' },
    { label: 'Members', value: game.memberCount },
  ]
  // Provenance earns a cell only when there IS a template behind the game.
  if (game.templateOrigin !== undefined) {
    stats.push({ label: 'From', value: `${game.templateOrigin} template` })
  }
  return stats
}

export function GameRow({ game, onDelete }: { game: GameRowGame; onDelete?: () => void }) {
  return (
    <EntityRow
      entityType="game"
      name={game.name}
      sheetHref={`/games/${game._id}`}
      linkAs={AppLink}
      stats={tableStats(game)}
      bodyStats={standingStats(game)}
      onDeleteClick={onDelete}
    />
  )
}
