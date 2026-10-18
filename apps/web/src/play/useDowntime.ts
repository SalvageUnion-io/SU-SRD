/**
 * useGameDowntime — a Game's Downtime, as Play follows it (play.md §6).
 *
 * Downtime is Game state, not the device's: the `downtime` row
 * (`convex/downtime.ts`). The Mediator starts, advances and ends it from
 * `PlayMediatorDowntime`, and every member's Play follows through one
 * `downtime.state` subscription (`usePlayDowntime` wraps it, beside the solo
 * seat's own); when it ends each player is back wherever their seat says. Each
 * member marks themselves done with the step (`markStepDone`), and
 * `games.members` names everyone the ready pips count. A pilot's step is
 * claimed before it applies (`claimStep`, `claimed`), so it applies once.
 *
 * Before the first answer arrives, Downtime reads as not running.
 *
 * Writes are refused here while Disconnected rather than queued (ADR-030 §1),
 * and a refusal from the server is shown in its own words. The server decides
 * who may do what: Start, Next step, End and Upkeep are the Mediator's.
 */

import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useConnection } from '../lib/connection/connectionContext'
import { reportBlockedWrite, reportRefusedWrite } from './useSeat'

/** A member of the Game, as a ready pip names them. */
type DowntimeMember = { userId: string; displayName: string }

/** What Play reads off the Game's Downtime. */
export type DowntimeView = {
  /** A step is running: `stepIndex !== null` on the row. */
  running: boolean
  /** The step the whole table is on, or null when Downtime is not running. */
  stepIndex: number | null
  /** Who has finished the current step. Clears on every advance. */
  completedBy: readonly DowntimeMember[]
  /** Upkeep is paid once per Downtime (`spendUpkeep`). */
  upkeepSpent: boolean
  /** Every member of the Game: one ready pip each. */
  members: readonly DowntimeMember[]
}

export type DowntimeHandle = {
  downtime: DowntimeView
  /** Mediator only: start a Downtime at its first step. */
  begin: () => void
  /** Mediator only: move the whole table to the next step. */
  advance: () => void
  /** Mediator only: put the whole table on a step, back or forward (Play's Back). */
  setStep: (stepIndex: number) => void
  /** Mediator only: end it; everyone returns to their seat. */
  end: () => void
  /** Mark yourself done with the current step, or not. */
  markDone: (done: boolean) => void
  /** Each step a pilot has claimed this Downtime (`downtime.claimStep`). */
  claimed: readonly { pilotId: string; stepIndex: number }[]
  /**
   * Claim the current step for one pilot before applying it. True when this
   * call claimed it; false when it was already claimed (apply nothing then)
   * or the write was refused (and said so).
   */
  claimStep: (pilotId: string, stepIndex: number) => Promise<boolean>
  /**
   * Mediator only: record Upkeep as paid for this Downtime. True when this
   * call paid it; false when it was already paid, or the write was refused
   * (and said so). The caller deducts the Scrap only on true.
   */
  spendUpkeep: () => Promise<boolean>
}

/** Downtime with no row, or before the first answer: not running. */
export const NOT_RUNNING: DowntimeView = {
  running: false,
  stepIndex: null,
  completedBy: [],
  upkeepSpent: false,
  members: [],
}

/** One Game's Downtime (none for null: not running, every write a no-op). */
export function useGameDowntime(gameId: Id<'games'> | null): DowntimeHandle {
  const { mode, canWrite, outdated } = useConnection()
  const signedIn = mode === 'connected' || mode === 'disconnected'
  const inGame = signedIn && gameId !== null ? { gameId } : 'skip'

  const state = useQuery(api.downtime.state, inGame)
  const members = useQuery(api.games.members, inGame)
  const begin = useMutation(api.downtime.begin)
  const advance = useMutation(api.downtime.advance)
  const end = useMutation(api.downtime.end)
  const setStep = useMutation(api.downtime.setStep)
  const markStepDone = useMutation(api.downtime.markStepDone)
  const claimStep = useMutation(api.downtime.claimStep)
  const spendUpkeep = useMutation(api.downtime.spendUpkeep)

  const downtime: DowntimeView =
    state === undefined
      ? NOT_RUNNING
      : {
          running: state.stepIndex !== null,
          stepIndex: state.stepIndex,
          completedBy: state.completedBy,
          upkeepSpent: state.upkeepSpent,
          members: (members ?? []).map((m) => ({ userId: m.userId, displayName: m.displayName })),
        }

  /** The Game to write to, or null (having said why) when no write may go. */
  function writableGame(): Id<'games'> | null {
    if (gameId === null) return null
    if (!canWrite) {
      reportBlockedWrite({ mode, outdated })
      return null
    }
    return gameId
  }

  /** Send one write, or say why it cannot be sent. */
  function send(write: (args: { gameId: Id<'games'> }) => Promise<unknown>): void {
    const target = writableGame()
    if (target === null) return
    write({ gameId: target }).catch(reportRefusedWrite)
  }

  return {
    downtime,
    begin: () => send((args) => begin(args)),
    advance: () => send((args) => advance(args)),
    setStep: (stepIndex) => send((args) => setStep({ ...args, stepIndex })),
    end: () => send((args) => end(args)),
    markDone: (done) => send((args) => markStepDone({ ...args, done })),
    claimed: state?.claimed ?? [],
    claimStep: async (pilotId, stepIndex) => {
      const target = writableGame()
      if (target === null) return false
      try {
        return await claimStep({ gameId: target, pilotId, stepIndex })
      } catch (err) {
        reportRefusedWrite(err)
        return false
      }
    },
    spendUpkeep: async () => {
      const target = writableGame()
      if (target === null) return false
      try {
        return await spendUpkeep({ gameId: target })
      } catch (err) {
        reportRefusedWrite(err)
        return false
      }
    },
  }
}
