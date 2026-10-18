/**
 * usePlayDowntime — the Downtime Play follows (play.md §3, §6): the Game's
 * `downtime` row (`useGameDowntime`), or with no Game the solo seat's own
 * (`downtime.soloState` and the `solo*` writes), as one handle.
 *
 * In a Game only its Mediator starts, advances and ends Downtime, so it is
 * `locked` for everyone else; the server refuses the writes whatever this
 * says. Solo, nobody else is at the table: the player runs it, and may put it
 * on any step (`setStep`); in a Game the Mediator may too (their Back).
 * The steps this pilot has done (`doneSteps`) are claimed before they apply
 * (`markStepDone`): on the solo seat, or in a Game on its Downtime row
 * (`downtime.claimStep`, per pilot), so a step applies once however often the
 * screen reloads, a player presses Undo or the Mediator goes Back. The
 * Mediator's own screen (no pilot) claims nothing. Writes are refused here while they cannot go
 * (Disconnected, Outdated), never queued (ADR-030 §1).
 */

import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import type { PlayTarget } from './play.model'
import type { PlayDowntime } from './situation.model'
import type { DowntimeView } from './useDowntime'
import { NOT_RUNNING, useGameDowntime } from './useDowntime'
import { reportBlockedWrite, reportRefusedWrite } from './useSeat'

export function usePlayDowntime(
  target: Pick<PlayTarget, 'gameId' | 'pilotId' | 'mediator'>
): PlayDowntime {
  const { mode, canWrite, outdated } = useConnection()
  const gameId = target.gameId as Id<'games'> | null
  const solo = gameId === null
  const signedIn = mode === 'connected' || mode === 'disconnected'

  const game = useGameDowntime(gameId)
  const soloState = useQuery(
    api.downtime.soloState,
    signedIn && solo ? { pilotId: target.pilotId } : 'skip'
  )
  const soloBegin = useMutation(api.downtime.soloBegin)
  const soloAdvance = useMutation(api.downtime.soloAdvance)
  const soloSetStep = useMutation(api.downtime.soloSetStep)
  const soloEnd = useMutation(api.downtime.soloEnd)
  const soloSpendUpkeep = useMutation(api.downtime.soloSpendUpkeep)
  const soloMarkStepDone = useMutation(api.downtime.soloMarkStepDone)

  if (!solo) {
    const pilotId = target.pilotId
    return {
      downtime: game.downtime,
      locked: !target.mediator,
      begin: game.begin,
      advance: game.advance,
      // The Mediator's Back: the Game's step, back or forward.
      setStep: target.mediator ? game.setStep : null,
      end: game.end,
      markDone: game.markDone,
      doneSteps:
        pilotId === ''
          ? null
          : game.claimed.filter((c) => c.pilotId === pilotId).map((c) => c.stepIndex),
      markStepDone: pilotId === '' ? null : (stepIndex) => game.claimStep(pilotId, stepIndex),
      spendUpkeep: game.spendUpkeep,
    }
  }

  // `soloState` answers null for a pilot no longer on the shelf: not running.
  const downtime: DowntimeView =
    soloState === undefined || soloState === null
      ? NOT_RUNNING
      : {
          running: soloState.stepIndex !== null,
          stepIndex: soloState.stepIndex,
          completedBy: [],
          upkeepSpent: soloState.upkeepSpent,
          members: [],
        }

  /** Whether a write may go now; when not, it says why. */
  function writable(): boolean {
    if (canWrite) return true
    reportBlockedWrite({ mode, outdated })
    return false
  }

  /** Send one solo write, or say why it cannot be sent. */
  function send(write: (args: { pilotId: string }) => Promise<unknown>): void {
    if (!writable()) return
    write({ pilotId: target.pilotId }).catch(reportRefusedWrite)
  }

  return {
    downtime,
    locked: false,
    begin: () => send((args) => soloBegin(args)),
    advance: () => send((args) => soloAdvance(args)),
    setStep: (stepIndex) => send((args) => soloSetStep({ ...args, stepIndex })),
    end: () => send((args) => soloEnd(args)),
    markDone: null,
    doneSteps: soloState?.doneSteps ?? [],
    markStepDone: async (stepIndex) => {
      if (!writable()) return false
      try {
        return await soloMarkStepDone({ pilotId: target.pilotId, stepIndex })
      } catch (err) {
        reportRefusedWrite(err)
        return false
      }
    },
    spendUpkeep: async () => {
      if (!writable()) return false
      try {
        return await soloSpendUpkeep({ pilotId: target.pilotId })
      } catch (err) {
        reportRefusedWrite(err)
        return false
      }
    },
  }
}
