import type { VitalChange } from './eventLines'

/**
 * The table's event stream (ADR-063 §7, as amended): one line per thing a member did in a
 * Game, in the order the room saw it. The Feed lists it, every other
 * member's screen toasts it, and the bound Discord channel mirrors it
 * (`../../worker/shared/tableEvents.ts`): one source, three readers.
 *
 * An event is a `change_log` row (`field` 'event'); a roll and the Mediator's
 * alert keep their own rows (`log.ts`) and are read here as events too, so
 * the stream is whole without a second copy of either.
 *
 * - **Who:** an event names its actor by Discord id, so a screen never toasts
 *   its own act. The Stop Sign names nobody (`safety.ts`).
 * - **Rapid repeats merge:** a second − / + nudge (a change of one) to the
 *   same vital of the same unit, or the same line again, inside `MERGE_MS`
 *   rewrites the line it follows ("HP 8 → 5", "×3") until the line is sealed
 *   (posted to Discord). A hit, any larger change to a vital, is a line of its
 *   own, so two hits are two lines (r2 I3). A change Undo wrote
 *   (`eventLines.ts`) is a line of its own too, marked "· Undo" (r3 B2).
 * - **A mech's line names its pilot:** "Reaper (GHOST) · Heat 2 → 3", whoever
 *   is aboard, else whoever it is assigned to (r3 B2).
 * - **Private:** a row marked `private` (the Mediator's private roll) is
 *   served to Mediators only and is never mirrored (`isMirrored`), until a
 *   Mediator reveals it.
 * - **Veiled:** an Opposition roll is served to a player as its veiled line,
 *   without the NPC's or the weapon's name, until a Mediator reveals it
 *   (`log.ts`, ADR-051 §9b).
 * - **Revealed:** a roll a Mediator revealed is everyone's, whole, wherever
 *   the stream is read: the Feed, a toast, "Last session", and the bound
 *   channel, which gets its line once (r3 A1).
 */

export type TableEventKind =
  | 'vitals'
  | 'action'
  | 'roll'
  | 'board'
  | 'assign'
  | 'join'
  | 'leave'
  | 'role'
  | 'session'
  | 'downtime'
  | 'proposal'
  | 'alert'
  | 'stop'
  /** A player ended their own turn (r4 B1): the Feed's line, and the Mediator's toast. */
  | 'turn'
  /** The Mediator took an alert back (r4 B4): the line left where the alert was. */
  | 'withdrawn'

/** One event as every reader gets it. */
export type TableEvent = {
  _id: string
  ts: number
  kind: TableEventKind
  /** The line: who and what, as the Feed, a toast and Discord all read it. */
  text: string
  /** Whose act it was; null for the Stop Sign, which names nobody but whoever lifted someone else's. */
  actorId: string | null
  /** Mediators' eyes only: never toasted to a player, never mirrored. */
  private?: true
  /**
   * A Mediator's copy of an Opposition roll the players read without its names
   * (ADR-051 §9b): theirs to reveal. Never set on what a player is served.
   */
  veiled?: true
  /**
   * A roll a Mediator showed the table (`changeLog.reveal`): no longer private
   * or veiled for anyone. A player's screen toasts it as it arrives, and the
   * bound channel is sent its line (`isMirrored`).
   */
  revealed?: true
  /** A roll a Mediator made: the one roll a screen toasts (`tableNotices.model.ts`). */
  mediator?: true
  /** The group session began or ended here: an end is what "Last time at the table" is cut by. */
  session?: 'start' | 'end'
  /**
   * A proposal's line that changed a sheet: its player accepted it, or undid
   * that (r3 A5). "Last session" counts both as changes to vitals (r3 K6).
   */
  answer?: 'accepted' | 'undone'
  /**
   * The member the event is about. An assignment taken from them: their
   * screen says so itself (`assignmentNotices`). A `role` event: who mediates
   * now, whose screen pins it. A proposal: whose it is to answer, whose
   * screen pins it.
   */
  about?: string
  vital?: VitalChange // A vitals line's change: what a session's recap adds up (r6 C1).
}

/** How long a line stays open to a repeat. */
export const MERGE_MS = 10_000

/** A proposal's Undo: its Mediator's row changes with it, so every list is served again (r5 A2). */
export const isUndone = (event: TableEvent): boolean => event.answer === 'undone'

/** Whether an event goes to the bound channel as a line: never a private one, nor one with its own post. */
export function isMirrored(event: TableEvent): boolean {
  if (event.private === true) return false
  // A roll posts as its card (`channelBindings.postRoll`), which a private one
  // never did and a veiled one did without its names: the reveal is its line.
  if (event.kind === 'roll') return event.revealed === true
  // An alert and the Stop Sign post as their own (`stopSign.ts`).
  return event.kind !== 'alert' && !event._id.startsWith('stop-up:')
}
