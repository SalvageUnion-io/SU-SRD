/**
 * The Game an encounter is prepared for (ADR-067 §3), as its sheet reads it:
 * the Games the viewer runs, and the chip the band wears for this one,
 * linking to that Game's Prep.
 */

import type { Encounter } from 'game-domain/schemas/encounter'
import { gamePrepPath } from '../../play/games/prep/gamePrep.model'
import { useGamesQuery } from '../../replica/roomCalls'

/** The Games the viewer runs the table of; none until they arrive, or signed out. */
export function useRunGames(connected: boolean) {
  const games = useGamesQuery('games.listMine', connected ? {} : 'skip')
  return (games ?? []).filter((g) => g.tableRunner)
}

/** The band's GAME chip for an encounter (or an NPC), when its Game is one the viewer runs. */
export function useEncounterGame(
  encounter: { gameId?: Encounter['gameId'] | null },
  connected: boolean
): { name: string; href: string } | undefined {
  const game = useRunGames(connected).find((g) => g._id === encounter.gameId)
  return game === undefined ? undefined : { name: game.name, href: gamePrepPath(game._id) }
}
