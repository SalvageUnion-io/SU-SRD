/**
 * usePlayDowntime — the Downtime Play follows (play.md §3, §6): the Game
 * room's `downtime` record, or with no Game the solo seat's own in the
 * account room, through the one set of `downtime` acts, as `useSeatAt` does
 * for the seat.
 *
 * In a Game only its Mediator starts, advances and ends Downtime, so it is
 * `locked` for everyone else; the server refuses the writes whatever this
 * says. Solo, nobody else is at the table: the player runs it, and may put it
 * on any step (`setStep`); in a Game the Mediator may too (their Back). Every
 * member's Play follows the Game's through one `downtime.state` read;
 * each member marks themselves done with the step (`markStepDone`), and
 * `games.members` names everyone the ready pips count.
 *
 * A step this pilot takes is one op with a stable id (`downtimeStepOpId`,
 * ADR-063 §6) carrying what it applies to the pilot, so it applies once
 * however often the screen reloads, a player presses Undo or the Mediator
 * goes Back; `doneSteps` reads them back. The Mediator's own screen (no
 * pilot) takes no step. Before the first answer
 * Downtime reads as not running. Writes go through `useGuardedWrite`: refused
 * here while they cannot go (Disconnected, Outdated), never queued (ADR-030
 * §1), and a server refusal is said in its own words.
 */

import { downtimeStepOpId } from 'game-domain/ops/downtimeStep'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useGuardedWrite } from '../lib/connection/useGuardedWrite'
import { PLAY_TXN } from '../replica/provenance'
import { useGamesQuery } from '../replica/roomCalls'
import { roomOf } from '../replica/roomSocket'
import { isSignedIn, WritesBlockedOffline } from '../replica/sync'
import { useSync } from '../replica/syncContext'
import { useTableAct, useTableRead } from '../replica/useTable'
import type { PlayScreen } from './play.model'
import type { DowntimeView, PlayDowntime } from './situation.model'

/** Downtime with no answer yet, or none running. */
const NOT_RUNNING: DowntimeView = {
  running: false,
  stepIndex: null,
  completedBy: [],
  upkeepSpent: false,
  members: [],
}

export function usePlayDowntime(target: PlayScreen): PlayDowntime {
  const signedIn = isSignedIn(useSync().status)
  const guarded = useGuardedWrite()
  const { gameId } = target
  const { pilotId } = target
  // Where the Downtime is: the Game's room, or the solo pilot's seat in the account room.
  const place = gameId === null ? { pilotId: pilotId ?? undefined } : {}
  const readable = signedIn && (gameId !== null || pilotId !== null)

  const state = useTableRead('downtime.state', readable ? { gameId, pilotId } : 'skip')
  const members = useGamesQuery(
    api.games.members,
    signedIn && gameId !== null ? { gameId: gameId as Id<'games'> } : 'skip'
  )
  const begin = useTableAct('downtime.begin', gameId)
  const advance = useTableAct('downtime.advance', gameId)
  const setStep = useTableAct('downtime.setStep', gameId)
  const end = useTableAct('downtime.end', gameId)
  const markStepDone = useTableAct('downtime.markStepDone', gameId)
  const spendUpkeep = useTableAct('downtime.spendUpkeep', gameId)
  // A room names its run; a solo one copied from Convex is named by when it started.
  const run = state?.runId ?? state?.startedAt ?? 0

  // `state` answers null for a solo pilot no longer on the shelf: not running.
  const downtime: DowntimeView =
    state === undefined || state === null
      ? NOT_RUNNING
      : {
          running: state.stepIndex !== null,
          stepIndex: state.stepIndex,
          completedBy: state.completedBy,
          upkeepSpent: state.upkeepSpent,
          members: (members ?? []).map((m) => ({ userId: m.userId, displayName: m.displayName })),
        }
  const solo = gameId === null
  const mayMove = solo || target.mediator

  return {
    downtime,
    locked: !mayMove,
    begin: () => guarded.send(() => begin(place)),
    advance: () => guarded.send(() => advance(place)),
    // Solo any step; in a Game the Mediator's Back.
    setStep: mayMove ? (stepIndex) => guarded.send(() => setStep({ ...place, stepIndex })) : null,
    end: () => guarded.send(() => end(place)),
    markDone: gameId === null ? null : (done) => guarded.send(() => markStepDone({ done })),
    doneSteps: pilotId === null ? null : (state?.doneSteps ?? []),
    markStepDone:
      pilotId === null
        ? null
        : (stepIndex, patch) =>
            guarded.ask(async () => {
              const op = {
                id: downtimeStepOpId(run, pilotId, stepIndex),
                unitId: pilotId,
                baseSeq: null,
                at: Date.now(),
                ...PLAY_TXN,
                patch,
              }
              const room = roomOf(gameId)
              if (room === null) throw new WritesBlockedOffline()
              await room.submit([op])
              // A step already taken is acked again, and changes nothing.
              return !(state?.doneSteps ?? []).includes(stepIndex)
            }),
    spendUpkeep: () => guarded.ask(() => spendUpkeep(place)),
  }
}
