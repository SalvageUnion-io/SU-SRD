/**
 * The Situation (play.md §3): On foot, Boarded or Downtime, and the `Play`
 * object every column of the Cockpit is handed (`usePlaySituation`).
 *
 * On foot and Boarded are the seat's mount. Downtime is the Game's
 * `downtime` row, set by its Mediator, or solo, the solo seat's own; while it
 * runs it wins over the mount. Pure: no React and no I/O.
 */

import { containerOf } from 'game-domain/container'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SeatMount } from 'game-domain/schemas/seat'
import type { SoftLink } from 'game-domain/schemas/softLink'
import type { BoardOption } from './boardMenu.model'
import type { PlayReadOnly, PlayTarget } from './play.model'
import type { SeatHandle } from './useSeat'

/** What the pilot is doing, as the Situation switch shows it. */
export type Situation = 'onFoot' | 'boarded' | 'downtime'

/** Downtime, while it runs, wins over the mount. */
export function situationOf(downtimeRunning: boolean, mount: SeatMount): Situation {
  if (downtimeRunning) return 'downtime'
  return mount.kind === 'boarded' ? 'boarded' : 'onFoot'
}

/**
 * A solo pilot's mechs, as the Board menu offers them: every mech on the
 * owner's shelf (what `seats.board` accepts for a solo seat), the pilot's
 * assigned mech (`mech-to-pilot`) first. A destroyed mech is listed with its
 * reason and boards nothing.
 */
export function soloMechOptions(
  pilotId: string,
  mechs: readonly Mech[],
  softLinks: readonly SoftLink[]
): BoardOption[] {
  const assigned =
    softLinks.find((l) => l.type === 'mech-to-pilot' && l.to.id === pilotId)?.from.id ?? null
  return mechs
    .filter((mech) => containerOf(mech).kind === 'shelf')
    .map(
      (mech): BoardOption => ({
        mechId: mech.id,
        serverId: null,
        name: mech.name,
        state: mech.destroyed === true ? 'destroyed' : 'yours',
        note: mech.destroyed === true ? 'Destroyed' : null,
      })
    )
    .sort((a, b) => Number(b.mechId === assigned) - Number(a.mechId === assigned))
}

/** A member of the Game, as a ready pip names them. */
type DowntimeMember = { userId: string; displayName: string }

/** What Play reads off a Downtime (`downtime.state`). */
export type DowntimeView = {
  /** A step is running. */
  running: boolean
  /** The step the table (or the solo pilot) is on, or null when Downtime is not running. */
  stepIndex: number | null
  /** Who has finished the current step; a Game's only. Clears on every move. */
  completedBy: readonly DowntimeMember[]
  /** Upkeep is paid once per Downtime (`spendUpkeep`). */
  upkeepSpent: boolean
  /** Every member of the Game: one ready pip each; none solo. */
  members: readonly DowntimeMember[]
}

/** The Game's or the solo seat's Downtime, and the writes Play may send for it. */
export type PlayDowntime = {
  downtime: DowntimeView
  /** In a Game and not its Mediator: Downtime is set by the Mediator. */
  locked: boolean
  /** Start a Downtime at its first step (the Mediator, or solo). */
  begin: () => void
  /** The next step (the Mediator, or solo). */
  advance: () => void
  /** Put the Downtime on a step, back or forward: solo, or the Game's Mediator; else null. */
  setStep: ((stepIndex: number) => void) | null
  /** End it: everyone goes back to their seat. */
  end: () => void
  /** In a Game only: mark yourself done with the step; null solo. */
  markDone: ((done: boolean) => void) | null
  /**
   * The steps this pilot has done this Downtime (applied or skipped), as the
   * server records them (their step ops), so a reload,
   * an Undo or the Mediator's Back never offers one again. Null on the
   * Mediator's own screen, which plays no pilot.
   */
  doneSteps: readonly number[] | null
  /**
   * Take a step for this pilot: its one op, carrying what it applies to the
   * pilot (empty to skip). True when this call took it; false when it was
   * already done (apply nothing more then) or the write was refused. Null on
   * the Mediator's own screen.
   */
  markStepDone:
    | ((stepIndex: number, pilotPatch: Record<string, unknown>) => Promise<boolean>)
    | null
  /**
   * Record the crawler's upkeep as paid for this Downtime. True when this call
   * paid it; deduct the Scrap only then.
   */
  spendUpkeep: () => Promise<boolean>
}

/**
 * Everything the Cockpit's columns read about the pilot's play, from one
 * `usePlaySituation(target)` call in `PlayCockpit`, handed to each column as
 * `play` so all three read the same thing.
 */
export type Play = {
  target: PlayTarget
  /** The pilot, from the store; null only while it has yet to arrive. */
  pilot: Pilot | null
  situation: Situation
  /** The mech the seat is boarded in, from the store, or null on foot. */
  boardedMech: Mech | null
  /** The boarded mech's id, even when the store does not hold it; null on foot. */
  boardedMechId: string | null
  /**
   * The mechs Board offers: in a Game the Board menu's (`boardMenu`), the
   * pilot's assigned mech first; solo every mech on the shelf. Each says
   * whether it may be boarded (`boardable`) and, when not, why.
   */
  mechs: BoardOption[]
  /** Climb out (Dismount); in Downtime the pilot may change it, and it waits. */
  setOnFoot: () => void
  /** Board one of `mechs`. */
  board: (mechId: string) => void
  /** Assign an unassigned spare in the Game to yourself, then board it. Confirm first. */
  assignAndBoard: (option: BoardOption) => void
  /** Start and end Downtime here: solo, or the Game's Mediator. */
  canChangeDowntime: boolean
  startDowntime: () => void
  endDowntime: () => void
  /** The seat: mount, range, effects and `resolving`, and every seat write (Eject included). */
  seat: SeatHandle
  /** Downtime: the step, upkeep, and its writes. */
  downtime: PlayDowntime
  /** Writes may go now (`useSync().canWrite`): offer controls only then. */
  canWrite: boolean
  /**
   * Why Play is read-only (Disconnected, Outdated, …), in words, or null while
   * `canWrite`: what a column says when it withdraws a control (`playReadOnly`).
   */
  readOnly: PlayReadOnly | null
}

/** What each Cockpit column is handed: who it is for, and the pilot's play. */
export type PlayColumnProps = { target: PlayTarget; play: Play }
