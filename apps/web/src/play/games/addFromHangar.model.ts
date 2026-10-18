/**
 * What "Add from your Hangar" offers on a Game's page (ADR-052 §5): your units
 * that could move into this Game, by kind, each with the relation chips that
 * show what the move touches — the Game it would leave (`GAME | Frostline`)
 * and the unit it is assigned to (`MECH | Scrapper`, `PILOT | Bonesaw`).
 *
 * A unit is offered only when the move would be accepted: `moveDestinations`
 * (the client mirror of ADR-037) lists this Game for it. So a pilot or mech
 * comes from the Hangar or any other Game, and a crawler only from the Hangar,
 * into a Game you run. Pure, so the rule is testable without a render.
 */

import type { Container } from 'game-domain/container'
import { containerOf, sameContainer } from 'game-domain/container'
import { gamePath } from 'game-domain/entityKinds'
import type { SoftLink } from 'game-domain/schemas/softLink'
import type { MoveTargetGame } from '../../lib/games/gameRoster'
import { moveDestinations } from '../../lib/games/gameRoster'
import type { ShelfRelation } from '../../lib/shelves/shelfItems'
import { mechRelations, pilotRelations } from '../../lib/shelves/shelfItems'

export type HangarKind = 'pilot' | 'mech' | 'crawler'

/** One unit the picker offers. */
export type HangarChoice = {
  kind: HangarKind
  id: string
  name: string
  /** Where it is now: the move's `current`. */
  current: Container
  /** Its relation chips, the Game it would leave first. */
  relations: ShelfRelation[]
}

type Unit = { id: string; name: string; gameId?: string | null | undefined }

/** The picker's three groups, in the build order the app teaches everywhere. */
export const HANGAR_GROUPS: ReadonlyArray<{ kind: HangarKind; title: string }> = [
  { kind: 'pilot', title: 'Pilots' },
  { kind: 'mech', title: 'Mechs' },
  { kind: 'crawler', title: 'Crawlers' },
]

export function hangarChoices(args: {
  gameId: string
  pilots: readonly Unit[]
  mechs: readonly Unit[]
  crawlers: readonly Unit[]
  softLinks: readonly SoftLink[]
  /** Your Games (`games.listMine`), which the moves are checked against. */
  games: readonly MoveTargetGame[]
}): Record<HangarKind, HangarChoice[]> {
  const target: Container = { kind: 'game', gameId: args.gameId }
  const pilotNames = new Map(args.pilots.map((p) => [p.id, p.name]))
  const mechNames = new Map(args.mechs.map((m) => [m.id, m.name]))

  /** The Game a unit would leave, as its relation; none from the Hangar (C6). */
  const leaving = (current: Container): ShelfRelation[] => {
    if (current.kind !== 'game') return []
    const game = args.games.find((g) => g._id === current.gameId)
    return [
      {
        key: 'game',
        label: 'Game',
        value: game?.name ?? 'Another Game',
        href: gamePath(current.gameId),
      },
    ]
  }

  const offer = (
    kind: HangarKind,
    units: readonly Unit[],
    linked: (unit: Unit) => ShelfRelation[]
  ): HangarChoice[] =>
    units.flatMap((unit) => {
      const current = containerOf(unit)
      if (sameContainer(current, target)) return []
      const accepted = moveDestinations({ kind, current, games: args.games }).some((d) =>
        sameContainer(d.container, target)
      )
      if (!accepted) return []
      return [
        {
          kind,
          id: unit.id,
          name: unit.name,
          current,
          relations: [...leaving(current), ...linked(unit)],
        },
      ]
    })

  return {
    pilot: offer('pilot', args.pilots, (p) =>
      pilotRelations({ pilot: p, softLinks: args.softLinks, mechNames })
    ),
    mech: offer('mech', args.mechs, (m) =>
      mechRelations({ mech: m, softLinks: args.softLinks, pilotNames })
    ),
    crawler: offer('crawler', args.crawlers, () => []),
  }
}
