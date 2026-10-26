/**
 * useGameFeed — what Play reads about the rest of the table (play.md §7,
 * §8): the Game's rolls, the Mediator's alerts and the proposals awaiting this
 * player for the Feed, and the crew's vitals, maxima and status
 * (`crew.vitals`, derived on the server, ADR-038 §4) for Crew.
 *
 * Every read is a Convex subscription, so a crewmate's roll, or the resolve
 * they are part-way through ("Rook is resolving Crush", ADR-038 §2), arrives
 * here as it happens.
 *
 * Beside the hook this file holds the crew's pure model: `CrewVitals`,
 * `CrewLine`, `crewLines`, `vitalText` and `describeResolve`. `crew.model.ts`
 * holds the Crew column's seat lines.
 */

import type { FunctionReturnType } from 'convex/server'
import { containerOf } from 'game-domain/container'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SeatResolving } from 'game-domain/schemas/seat'
import { coreRollBandLabel } from 'salvageunion-reference/rules'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { gauge, pool } from '../lib/units/crewPair'
import { isSignedIn } from '../replica/sync'
import { useSync } from '../replica/syncContext'
import { useTableRead } from '../replica/useTable'
import type { BoardSources } from './boardMenu.model'

/** One roll on the Game's log (`changeLog.rolls`). */
export type RollLine = {
  _id: string
  ts: number
  description: string
  /** Who rolled; null when the row names nobody. */
  actorName: string | null
  /** 'play', 'discord-bot', … */
  source: string
}

/** One Mediator alert (`changeLog.alerts`). */
export type AlertLine = { _id: string; message: string; ts: number }

/** A proposal awaiting this player's answer (`ops.pending`). */
export type PendingProposal = FunctionReturnType<typeof api.ops.pending>[number]

/** The crew as the server derives it (`crew.vitals`). */
export type CrewVitals = FunctionReturnType<typeof api.crew.vitals>

/** One crewmate, as Play's Crew reads it. */
export type CrewLine = {
  pilotId: string
  name: string
  /** The pilot this screen plays. */
  self: boolean
  /** "4/17": their HP. */
  hp: string
  /** "5/7": their AP. */
  ap: string
  /**
   * Where they are and in what: "In Spectrum · SP 6/9", "On foot · Scrapper
   * parked", or "On foot".
   */
  unit: string
  /**
   * The mech assigned to them, as its Mini reads it: its row id, name, SP
   * (`6/9`) and whether they are aboard. Null with none.
   */
  unitMech: { id: string; name: string; sp: string; boarded: boolean } | null
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
  /** Newest first; null while the first answer is on its way. */
  rolls: RollLine[] | null
  /** Newest first. */
  alerts: AlertLine[]
  /** Proposals waiting for this player's answer, newest first: Play's Feed answers them inline (play.md §8). */
  proposals: PendingProposal[]
  /** Every crewmate's vitals and derived status; null until it arrives. */
  crew: CrewVitals | null
}

/** How many rolls the Feed shows. */
const LOG_ROLLS = 30

/** How many alerts the Feed shows. */
const LOG_ALERTS = 10

export function useGameFeed(pilot: Pilot | null): GameFeed {
  const { status } = useSync()
  const container = pilot === null ? null : containerOf(pilot)
  const gameId = container?.kind === 'game' ? (container.gameId as Id<'games'>) : null
  const signedIn = isSignedIn(status)
  const inGame = signedIn && gameId !== null

  const rolls = useTableRead(api.changeLog.rolls, inGame ? { gameId, limit: LOG_ROLLS } : 'skip')
  const alerts = useTableRead(api.changeLog.alerts, inGame ? { gameId, limit: LOG_ALERTS } : 'skip')
  const pending = useTableRead(api.ops.pending, inGame ? { gameId } : 'skip')
  const crew = useTableRead(api.crew.vitals, inGame ? { gameId } : 'skip')

  return {
    rolls: rolls ?? null,
    alerts: alerts ?? [],
    proposals: pending ?? [],
    crew: crew ?? null,
  }
}

/** A resolve in progress, as the crew reads it. */
export function describeResolve(pilotName: string, resolving: SeatResolving): string {
  const head = `${pilotName} is resolving ${resolving.name}`
  if (resolving.roll !== undefined) {
    const label = coreRollBandLabel(resolving.roll.band)
    const tail = resolving.applied ? ', applied' : ''
    return `${head}: rolled ${resolving.roll.roll}, ${label}${tail}`
  }
  return resolving.activated ? `${head}: activated` : head
}

/**
 * A vital as the crew reads it: `crewPair`'s `pool` (HP, AP, SP, EP: an absent
 * current is full) or `gauge` (Heat: an absent current is empty), "12/16"; or
 * the stored value alone while the maximum is unknown.
 */
export function vitalText(
  kind: 'pool' | 'gauge',
  current: number | null,
  max: number | null
): string {
  const reading = (kind === 'pool' ? pool : gauge)('', current, max)[0]
  if (reading !== undefined) return String(reading.value)
  return current === null ? '—' : String(current)
}

/** A vital's current value alone ("22" of "22/30"), for a line that shows one number. */
export function vitalCurrent(
  kind: 'pool' | 'gauge',
  current: number | null,
  max: number | null
): string {
  return vitalText(kind, current, max).split('/')[0] ?? '—'
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
 * screen plays comes first.
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
  /** The pilot this screen plays; null for the Mediator's, which plays none. */
  pilotId: string | null
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
        ? `${mech.name} · SP ${vitalText('pool', mech.currentSP, mech.maxSP)} · Heat ${vitalText('gauge', mech.currentHeat, mech.maxHeat)}`
        : [`${mech.name} parked`, ...parkedProblems(mech.status)].join(', ')
    }
    const resolving = resolvingOf.get(id) ?? null
    const hp = vitalText('pool', p.currentHP, p.maxHP)
    const ap = vitalText('pool', p.currentAP, p.maxAP)
    const unit =
      mech === undefined
        ? p.boarded
          ? 'In a mech'
          : 'On foot'
        : p.boarded
          ? `In ${mech.name} · SP ${vitalText('pool', mech.currentSP, mech.maxSP)}`
          : `On foot · ${mech.name} parked`
    lines.push({
      pilotId: id,
      name: p.name,
      self: id === pilotId,
      hp,
      ap,
      unit,
      unitMech:
        mech === undefined
          ? null
          : {
              id: mech._id,
              name: mech.name,
              sp: vitalText('pool', mech.currentSP, mech.maxSP),
              boarded: p.boarded,
            },
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
