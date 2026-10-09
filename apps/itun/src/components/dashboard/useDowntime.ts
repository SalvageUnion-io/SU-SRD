/**
 * useDowntime — the Game's Downtime, as the Dashboard follows it
 * (docs/architecture/dashboard-redesign.md D8; ADR-038 §5).
 *
 * Downtime is Game state, not the device's: the `downtime` row
 * (`convex/downtime.ts`) the Game hub's `DowntimePanel` already runs. The
 * Mediator starts, advances and ends it, and every member's Dashboard follows
 * through one `downtime.state` subscription: while a step is running the
 * Crawler takes the Major slot, and when it ends each player is back wherever
 * their seat says. Each member marks themselves done with the step
 * (`markStepDone`), and `games.members` names everyone the ready pips count.
 *
 * Needs a Convex provider, like `useSeat`: call it only when
 * `isConvexConfigured`, and use `NO_DOWNTIME` otherwise. Before the first
 * answer arrives, Downtime reads as not running.
 *
 * Writes are refused here while Disconnected rather than queued (ADR-030 §1),
 * and a refusal from the server is shown in its own words. The server decides
 * who may do what: Start, Next step, End and Upkeep are the Mediator's.
 */

import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { containerOf } from '../../lib/container'
import { reportWriteFailure } from '../../lib/runWrite'
import type { Pilot } from '../../lib/schemas/pilot'
import { WritesBlockedOffline } from '../../stores/entityBackend'
import { reportRefusedWrite } from './useSeat'

/** A member of the Game, as a ready pip names them. */
export type DowntimeMember = { userId: string; displayName: string }

/** What the Dashboard reads off the Game's Downtime. */
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
  /** Mediator only: end it; everyone returns to their seat. */
  end: () => void
  /** Mark yourself done with the current step, or not. */
  markDone: (done: boolean) => void
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

function ignore(): void {
  // Nothing to write to: see `NO_DOWNTIME`.
}

/** A build with no deployment: never in Downtime, and nowhere to write. */
export const NO_DOWNTIME: DowntimeHandle = {
  downtime: NOT_RUNNING,
  begin: ignore,
  advance: ignore,
  end: ignore,
  markDone: ignore,
  spendUpkeep: async () => false,
}

/**
 * The Game's Downtime for the pilot's Game, and the writes that drive it.
 *
 * Needs a Convex provider: call it only when `isConvexConfigured`, and use
 * `NO_DOWNTIME` otherwise.
 */
export function useDowntime(pilot: Pilot | null): DowntimeHandle {
  const { mode, canWrite, outdated } = useConnection()
  const container = pilot === null ? null : containerOf(pilot)
  const gameId = container?.kind === 'game' ? (container.gameId as Id<'games'>) : null
  const signedIn = mode === 'connected' || mode === 'disconnected'
  const inGame = signedIn && gameId !== null ? { gameId } : 'skip'

  const state = useQuery(api.downtime.state, inGame)
  const members = useQuery(api.games.members, inGame)
  const begin = useMutation(api.downtime.begin)
  const advance = useMutation(api.downtime.advance)
  const end = useMutation(api.downtime.end)
  const markStepDone = useMutation(api.downtime.markStepDone)
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
      reportWriteFailure(
        new WritesBlockedOffline(
          outdated ? 'outdated' : mode === 'connecting' ? 'settling' : 'offline'
        )
      )
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
    end: () => send((args) => end(args)),
    markDone: (done) => send((args) => markStepDone({ ...args, done })),
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
