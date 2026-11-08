/**
 * What a table plays under, read and written through its room: the Scene, the
 * salvage area and the Stop Sign, the Mediator's
 * Opposition tray and running encounter, the table in play: the seats, the
 * Downtime, the proposals, the feed and the crew's vitals; and who may read
 * each of the player's saved patterns.
 *
 * `useTableRead` reads a room's record (`tableState.ts`) as the read of that
 * name answers it, and `useTableAct` sends an act of that name to a Game's
 * room, or the account room's for the solo table (`gameId` null).
 */

import type { RunningEncounter } from 'game-domain/schemas/encounter'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { z } from 'salvageunion-reference/zod'
import type { PatternSharing } from '../rooms/account/sharing'
import type { SoloSeatRead } from '../rooms/account/soloPlay'
import type { GameActName, GameActResult } from '../rooms/game/acts'
import type { AlertRow, RollRow } from '../rooms/game/log'
import type { DowntimeRead } from '../rooms/game/play'
import type { ProposalRead, SentProposal } from '../rooms/game/proposals'
import type { ACCOUNT_SOCKET_ACTS, GAME_SOCKET_ACTS } from '../rooms/game/socketActs'
import type { Member } from '../rooms/game/store'
import type { SeatRead } from '../rooms/seats'
import type { CrewVitals } from '../rooms/vitals'
import type { Scope } from './replica'
import { gameScope } from './replica'
import { useGamesQuery } from './roomCalls'
import { roomReady } from './roomSocket'
import { WritesBlockedOffline } from './sync'
import type { StateTable } from './tableState'
import { readTableState, subscribeTableState } from './tableState'

/** A query's args, as a screen passes them. */
export type ReadArgs = { gameId?: string | null; pilotId?: string | null; limit?: number }
type Args = ReadArgs

/**
 * How a room answers a query a screen reads: the record table that holds it
 * (by the query's args, where they choose), and what of that record the query
 * answered, when not all of it. An answer keeps undefined (not yet served) as
 * it is.
 */
type Answer = {
  table: StateTable | ((args: Args) => StateTable)
  answer?: (held: unknown, args: Args) => unknown
}

/** The newest `limit` of a feed, newest first. */
function newest(fallback: number) {
  return (held: unknown, args: Args) => (held as unknown[]).slice(0, args.limit ?? fallback)
}

/** A solo pilot's seat, as `seats.solo` answered: null for one not on the Shelf. */
function soloSeat(held: unknown, args: Args): SoloSeatRead | null {
  return (held as SoloSeatRead[]).find((seat) => seat.pilotId === args.pilotId) ?? null
}

/** A Downtime as one pilot reads it: the steps they took, not every pilot's. */
type DowntimeState = Omit<DowntimeRead, 'doneSteps' | 'runId'> & {
  runId?: string | null
  doneSteps: number[]
}

const NOT_RUNNING: DowntimeState = {
  running: false,
  runId: null,
  stepIndex: null,
  startedAt: null,
  completedBy: [],
  upkeepSpent: false,
  doneSteps: [],
}

/**
 * `downtime.state`: a Game's, with the steps `pilotId` took; or a solo
 * pilot's, off its seat (null for one not on the Shelf).
 */
function downtimeState(held: unknown, args: Args): DowntimeState | null {
  if (args.gameId != null) {
    const game = held as DowntimeRead | null
    if (game === null) return null
    return { ...game, doneSteps: game.doneSteps[args.pilotId ?? ''] ?? [] }
  }
  const seat = soloSeat(held, args)
  if (seat === null) return null
  return seat.downtime === null ? NOT_RUNNING : { ...seat.downtime, running: true, completedBy: [] }
}

/**
 * A Game's member as a screen names them: the name their account goes by
 * (`games.names`, read fresh, never stored in the Game), else the one the
 * Game last heard, else Crewmate.
 */
type GameMemberRead = Omit<Member, 'displayName' | 'avatarUrl'> & {
  displayName: string
  avatarUrl?: string
}

function memberRead({ displayName, avatarUrl, ...member }: Member): GameMemberRead {
  return {
    ...member,
    displayName: displayName ?? CREWMATE,
    ...(avatarUrl === null ? {} : { avatarUrl }),
  }
}

const CREWMATE = 'Crewmate'

/** The roster with each member's account name over the one the Game holds. */
export function namedMembers(
  members: readonly GameMemberRead[],
  names: Readonly<Record<string, string>> | undefined
): GameMemberRead[] {
  if (names === undefined) return [...members]
  return members.map((m) => {
    const name = names[m.userId]
    return name === undefined || name === m.displayName ? m : { ...m, displayName: name }
  })
}

/** Each read a screen makes, by name. */
const ANSWERED_BY: Record<ReadName, Answer> = {
  // The roster, in join order, off the Game's snapshot.
  'games.members': {
    table: 'members',
    answer: (held) => (held as Member[]).map(memberRead),
  },
  'scenes.current': { table: 'scene' },
  'salvageAreas.here': { table: 'salvageArea' },
  'safety.stopSign': { table: 'safety' },
  'session.state': { table: 'session' },
  // The one `mediator` record is the running encounter, and having it at all is mediating.
  'mediator.npcs': { table: 'opposition' },
  'mediator.running': {
    table: 'mediator',
    answer: (held) => (held as { running?: unknown } | null)?.running ?? null,
  },
  'mediator.amMediator': { table: 'mediator', answer: (held) => held !== null },
  'seats.forGame': { table: 'seats' },
  'seats.solo': { table: 'seats', answer: soloSeat },
  'downtime.state': {
    table: (args) => (args.gameId == null ? 'seats' : 'downtime'),
    answer: downtimeState,
  },
  'ops.pending': { table: 'proposals' },
  'ops.sent': { table: 'sentProposals', answer: newest(20) },
  'changeLog.rolls': { table: 'rolls', answer: newest(30) },
  'changeLog.alerts': { table: 'alerts', answer: newest(20) },
  'crew.vitals': { table: 'crew' },
  'shelf.patternSharing': { table: 'sharing' },
}

/** What each read answers, as its screen reads it. */
type Reads = {
  'games.members': GameMemberRead[]
  'scenes.current': GameActResult<'scenes.current'>
  'salvageAreas.here': GameActResult<'salvageAreas.here'>
  'safety.stopSign': GameActResult<'safety.stopSign'>
  'session.state': GameActResult<'session.state'>
  'mediator.npcs': { _id: string; body: Record<string, unknown> }[]
  'mediator.running': RunningEncounter | null
  'mediator.amMediator': boolean
  'seats.forGame': SeatRead[]
  'seats.solo': SoloSeatRead | null
  'downtime.state': DowntimeState | null
  'ops.pending': ProposalRead[]
  'ops.sent': SentProposal[]
  'changeLog.rolls': RollRow[]
  'changeLog.alerts': AlertRow[]
  'crew.vitals': CrewVitals | null
  'shelf.patternSharing': (PatternSharing & { appId: string })[]
}
export type ReadName = keyof Reads
export type ReadAnswer<N extends ReadName> = Reads[N]

/** The acts a screen sends a room, with the args it sends. */
type Acts = typeof GAME_SOCKET_ACTS & typeof ACCOUNT_SOCKET_ACTS
export type TableActName = keyof Acts
export type TableActArgs<N extends TableActName> = z.input<Acts[N]>
type TableActResult<N extends TableActName> = N extends GameActName
  ? Awaited<GameActResult<N>>
  : unknown

/** A Game's room, or the account room's for the solo table (`gameId` null). */
function scopeOf(gameId: string | null): Scope {
  return gameId === null ? 'account' : gameScope(gameId)
}

/** Each answer made from a held record, per args: stable between changes, for `useSyncExternalStore`. */
const made = new WeakMap<object, Map<string, unknown>>()

function answered(name: ReadName, how: Answer, held: unknown, args: Args): unknown {
  if (held === undefined || how.answer === undefined) return held
  if (held === null || typeof held !== 'object') return how.answer(held, args)
  const key = `${name}\u0000${JSON.stringify(args)}`
  const answers = made.get(held) ?? new Map<string, unknown>()
  made.set(held, answers)
  if (!answers.has(key)) answers.set(key, how.answer(held, args))
  return answers.get(key)
}

/** The read `name` from its room's record: undefined until the room's snapshot, or while skipped. */
export function useTableRead<N extends ReadName>(
  name: N,
  args: ReadArgs | 'skip'
): ReadAnswer<N> | undefined {
  const how = ANSWERED_BY[name]
  const given = args === 'skip' ? null : args
  const held = useSyncExternalStore(subscribeTableState, () => {
    if (given === null) return undefined
    const table = typeof how.table === 'string' ? how.table : how.table(given)
    return answered(name, how, readTableState(scopeOf(given.gameId ?? null), table), given)
  }) as ReadAnswer<N> | undefined
  // A roster's names are read from the members' accounts, not the Game.
  const gameId = name === 'games.members' ? (given?.gameId ?? null) : null
  const names = useGamesQuery('games.names', gameId === null ? 'skip' : { gameId })
  return useMemo(
    () =>
      gameId === null || held === undefined
        ? held
        : (namedMembers(held as GameMemberRead[], names) as ReadAnswer<N>),
    [gameId, held, names]
  )
}

/** The act `name`, sent to `gameId`'s room (the account room's when null); refused offline. */
export function useTableAct<N extends TableActName>(
  name: N,
  gameId: string | null
): (args: TableActArgs<N>) => Promise<TableActResult<N>> {
  return useCallback(
    // A socket still opening is waited for (`roomReady`), as a unit write's is.
    async (args: TableActArgs<N>) => {
      const room = await roomReady(gameId, { standIns: false })
      if (room === null) throw new WritesBlockedOffline()
      return (await room.act(name, args)) as TableActResult<N>
    },
    [name, gameId]
  )
}
