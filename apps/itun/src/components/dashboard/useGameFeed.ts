/**
 * useGameFeed — what the Dashboard reads about the rest of the table
 * (docs/architecture/dashboard-redesign.md §4.2): the Game's rolls and the
 * Mediator's alerts for the Log tab, the proposal count for the bottom strip,
 * the Game's name for the rail, and each crewmate's seat for the Crew tab.
 *
 * Every read is a Convex subscription, so a crewmate's roll, or the resolve
 * they are part-way through ("Rook is resolving Crush", plan §8 A6), arrives
 * here as it happens. Needs a Convex provider, like `useSeat`: call it only
 * when `isConvexConfigured`, and use `NO_GAME_FEED` otherwise.
 */

import { useQuery } from 'convex/react'
import { CORE_ROLL_BANDS } from 'salvageunion-reference/rules'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { containerOf } from '../../lib/container'
import type { Pilot } from '../../lib/schemas/pilot'
import type { SeatResolving } from '../../lib/schemas/seat'
import type { BoardSources } from './boardMenu'
import { linkId, nameOf } from './boardMenu'

/** One roll on the Game's log (`changeLog.rolls`). */
export type RollLine = {
  _id: string
  ts: number
  description: string
  /** Who rolled; null when the row names nobody. */
  actorName: string | null
  /** 'dashboard', 'discord-bot', … */
  source: string
}

/** One Mediator alert (`proposals.alerts`). */
export type AlertLine = { _id: string; message: string; ts: number }

/** One crewmate's seat, as the Crew tab reads it. */
export type CrewLine = {
  pilotId: string
  name: string
  /** The pilot this Dashboard plays. */
  self: boolean
  /** "On foot", or "In <mech>". */
  where: string
  /** What they are resolving, in words, or null. */
  resolving: string | null
}

export type GameFeed = {
  /** The Game's name, or null before it arrives. */
  gameName: string | null
  /** The Game's hub, where the proposal inbox is answered. */
  gameHref: string | null
  /** Newest first; null while the first answer is on its way. */
  rolls: RollLine[] | null
  /** Newest first. */
  alerts: AlertLine[]
  /** Proposals waiting for this player's answer. */
  inbox: number
}

/** No deployment, or no Game: nothing to read. */
export const NO_GAME_FEED: GameFeed = {
  gameName: null,
  gameHref: null,
  rolls: null,
  alerts: [],
  inbox: 0,
}

/** How many rolls the Log tab shows. */
const LOG_ROLLS = 30

/** How many alerts the Log tab shows; the strip shows the newest. */
const LOG_ALERTS = 10

export function useGameFeed(pilot: Pilot | null): GameFeed {
  const { mode } = useConnection()
  const container = pilot === null ? null : containerOf(pilot)
  const gameId = container?.kind === 'game' ? (container.gameId as Id<'games'>) : null
  const signedIn = mode === 'connected' || mode === 'disconnected'
  const inGame = signedIn && gameId !== null

  const game = useQuery(api.games.get, inGame ? { gameId } : 'skip')
  const rolls = useQuery(api.changeLog.rolls, inGame ? { gameId, limit: LOG_ROLLS } : 'skip')
  const alerts = useQuery(api.proposals.alerts, inGame ? { gameId, limit: LOG_ALERTS } : 'skip')
  const pending = useQuery(api.proposals.pending, inGame ? { gameId } : 'skip')

  return {
    gameName: game?.name ?? null,
    gameHref: gameId === null ? null : `/games/${gameId}`,
    rolls: rolls ?? null,
    alerts: alerts ?? [],
    inbox: pending?.length ?? 0,
  }
}

/** A resolve in progress, as the crew reads it. */
export function describeResolve(pilotName: string, resolving: SeatResolving): string {
  const head = `${pilotName} is resolving ${resolving.name}`
  if (resolving.roll !== undefined) {
    const label = CORE_ROLL_BANDS[resolving.roll.band].label
    const tail = resolving.applied ? ', applied' : ''
    return `${head}: rolled ${resolving.roll.roll}, ${label}${tail}`
  }
  return resolving.activated ? `${head}: activated` : head
}

/**
 * One line per pilot in the Game, from the same listing and seats the Board
 * menu reads (`useBoardSources`). The pilot this Dashboard plays comes first.
 */
export function crewLines(sources: BoardSources, pilotId: string): CrewLine[] {
  const { listing } = sources
  if (listing === null) return []
  const mechName = new Map<string, string>()
  for (const m of listing.mechs) {
    const id = linkId(m)
    if (id !== null) mechName.set(id, nameOf(m.body, 'a mech'))
  }
  const seatOf = new Map(sources.seats.map((s) => [s.pilotId, s]))

  const lines: CrewLine[] = []
  for (const p of listing.pilots) {
    const id = linkId(p)
    if (id === null) continue
    const name = nameOf(p.body, 'A pilot')
    const seat = seatOf.get(id)
    const where =
      seat?.mount.kind === 'boarded'
        ? `In ${mechName.get(seat.mount.mechId) ?? 'a mech'}`
        : 'On foot'
    lines.push({
      pilotId: id,
      name,
      self: id === pilotId,
      where,
      resolving: seat?.resolving ? describeResolve(name, seat.resolving) : null,
    })
  }
  return lines.sort((a, b) => Number(b.self) - Number(a.self))
}
