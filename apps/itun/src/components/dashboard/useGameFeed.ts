/**
 * useGameFeed — what the Dashboard reads about the rest of the table
 * (docs/architecture/dashboard.md §6): the Game's rolls and the
 * Mediator's alerts for the Log tab, the proposal count for the bottom strip,
 * the Game's name for the rail, and the crew's vitals, maxima and status
 * (`crew.vitals`, derived on the server, ADR-038 §4) for the Crew tab.
 *
 * Every read is a Convex subscription, so a crewmate's roll, or the resolve
 * they are part-way through ("Rook is resolving Crush", ADR-038 §2), arrives
 * here as it happens. Needs a Convex provider, like `useSeat`: call it only
 * when `isConvexConfigured`, and use `NO_GAME_FEED` otherwise.
 */

import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { CORE_ROLL_BANDS, resolveGauge, resolvePool } from 'salvageunion-reference/rules'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { containerOf } from '../../lib/container'
import type { Pilot } from '../../lib/schemas/pilot'
import type { SeatResolving } from '../../lib/schemas/seat'
import type { BoardSources } from './boardMenu'

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

/** The crew as the server derives it (`crew.vitals`). */
export type CrewVitals = FunctionReturnType<typeof api.crew.vitals>

/** One crewmate, as the Crew tab reads it. */
export type CrewLine = {
  pilotId: string
  name: string
  /** The pilot this Dashboard plays. */
  self: boolean
  /** Their live sheet: read-only, and live, when it is a crewmate's. */
  href: string
  /** "On foot", or "In <mech>". */
  where: string
  /** "HP 4/17 · AP 5/7". */
  vitals: string
  /**
   * Their mech: its SP and Heat while their seat has them aboard, else one
   * line for the mech assigned to them, parked, with what is wrong with it.
   * Null with neither.
   */
  mech: string | null
  /** The parked mech is what draws the outline: its line reads as a problem. */
  mechAttention: boolean
  /** What needs looking at, in words ("Injured", "Overheating"). */
  problems: string[]
  /** The ▲ and red outline: the server's verdict on the pilot or their mech. */
  attention: boolean
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
  /** Every crewmate's vitals and derived status; null until it arrives. */
  crew: CrewVitals | null
}

/** No deployment, or no Game: nothing to read. */
export const NO_GAME_FEED: GameFeed = {
  gameName: null,
  gameHref: null,
  rolls: null,
  alerts: [],
  inbox: 0,
  crew: null,
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
  const crew = useQuery(api.crew.vitals, inGame ? { gameId } : 'skip')

  return {
    gameName: game?.name ?? null,
    gameHref: gameId === null ? null : `/games/${gameId}`,
    rolls: rolls ?? null,
    alerts: alerts ?? [],
    inbox: pending?.length ?? 0,
    crew: crew ?? null,
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

/** "12/16", or the stored value alone while the maximum is unknown. */
function pool(current: number | null, max: number | null, gauge = false): string {
  if (max === null) return current === null ? '—' : String(current)
  const stored = current ?? undefined
  const value = gauge ? resolveGauge(stored, max) : resolvePool(stored, max)
  return `${value}/${max}`
}

type CrewMech = CrewVitals['mechs'][number]

/** What is wrong with a boarded mech, in words. */
function mechProblems(status: CrewMech['status']): string[] {
  if (status === null) return []
  return [
    ...(status.destroyed ? ['Mech destroyed'] : []),
    ...(status.overheating ? ['Overheating'] : []),
    ...(status.shutdown ? ['Shut down'] : []),
    ...[...status.destroyedSystems, ...status.destroyedModules].map((item) => `${item} destroyed`),
  ]
}

/** What is wrong with a parked mech, as the tail of its one line. */
function parkedProblems(status: CrewMech['status']): string[] {
  if (status === null) return []
  const count = (n: number, noun: string) =>
    n === 0 ? [] : [`${n} ${noun}${n === 1 ? '' : 's'} destroyed`]
  return [
    ...(status.destroyed ? ['destroyed'] : []),
    ...(status.overheating ? ['overheating'] : []),
    ...count(status.destroyedSystems.length, 'system'),
    ...count(status.destroyedModules.length, 'module'),
  ]
}

/**
 * One line per pilot in the Game, from the server's crew status
 * (`crew.vitals`) and the seats (what each is resolving). The pilot this
 * Dashboard plays comes first.
 *
 * A boarded pilot's line carries their mech's SP and Heat and what is wrong
 * with it; a pilot on foot gets one line naming the mech assigned to them,
 * parked, and what is wrong with it when that is what draws the
 * outline. The ▲ and red outline are the server's `attention`, so every
 * client flags the same crewmates.
 *
 * Pilots, mechs and seats are keyed by the server's `linkId`, never `appId`:
 * a template pre-gen (Starter Set) has no app id, only its body id, and the
 * seats and `mechId` name it by that.
 */
export function crewLines(
  crew: CrewVitals | null,
  seats: BoardSources['seats'],
  pilotId: string
): CrewLine[] {
  if (crew === null) return []
  const mechs = new Map<string, CrewMech>()
  for (const m of crew.mechs) if (m.linkId !== null) mechs.set(m.linkId, m)
  const resolvingOf = new Map(seats.map((s) => [s.pilotId, s.resolving ?? null]))

  const lines: CrewLine[] = []
  for (const p of crew.pilots) {
    const id = p.linkId
    if (id === null) continue
    const mech = p.mechId === null ? undefined : mechs.get(p.mechId)
    let mechLine: string | null = null
    if (mech !== undefined) {
      mechLine = p.boarded
        ? `${mech.name} · SP ${pool(mech.currentSP, mech.maxSP)} · Heat ${pool(mech.currentHeat, mech.maxHeat, true)}`
        : [`${mech.name} parked`, ...parkedProblems(mech.status)].join(', ')
    }
    const resolving = resolvingOf.get(id) ?? null
    lines.push({
      pilotId: id,
      name: p.name,
      self: id === pilotId,
      href: `/sheet/pilot/${id}`,
      where: p.boarded ? `In ${mech?.name ?? 'a mech'}` : 'On foot',
      vitals: `HP ${pool(p.currentHP, p.maxHP)} · AP ${pool(p.currentAP, p.maxAP)}`,
      mech: mechLine,
      mechAttention: !p.boarded && (mech?.attention ?? false),
      problems: [
        ...(p.status.dead ? ['Dead'] : p.status.injured ? ['Injured'] : []),
        ...(p.status.ejected ? ['Ejected'] : []),
        ...(p.boarded && mech !== undefined ? mechProblems(mech.status) : []),
      ],
      attention: p.attention || (mech?.attention ?? false),
      resolving: resolving ? describeResolve(p.name, resolving) : null,
    })
  }
  return lines.sort((a, b) => Number(b.self) - Number(a.self))
}
