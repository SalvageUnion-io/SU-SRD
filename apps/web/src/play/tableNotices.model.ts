/**
 * What a member is told about their Games wherever they are in the app
 * (play.md §19), pure: which of the table's events a screen toasts, and which
 * alerts the pinned banner still shows.
 *
 * The stream is the room's (`rooms/game/events.ts`), the Feed's own source,
 * so a toast and its Feed line are the same event.
 */

import type { TableEvent } from '../rooms/game/events'

/**
 * The window event the notices raise when their height changes: Play's frame
 * fills the window below its own top, and a notice leaving moves that top
 * without resizing anything the frame can watch.
 */
export const NOTICES_RESIZED = 'su-table-notices-resized'

/** How long the Mediator's alert stays pinned unless dismissed. */
const ALERT_PINNED_MS = 10 * 60_000

/** How long "You now mediate" stays pinned unless dismissed: long enough to be met at the next visit. */
const ROLE_PINNED_MS = 7 * 24 * 60 * 60_000

/** What a screen has already heard of one Game's events: each id's line as last toasted. */
export type Heard = ReadonlyMap<string, string>

/**
 * What a toast is kept for (r2 C4): what needs a look. A proposal, the
 * Mediator's alert, the session starting and ending, Downtime beginning and
 * ending, and a roll the Mediator made. Every crewmate's vitals, actions,
 * boarding, assignments and rolls go to the Feed alone: a toast for each
 * stacked over the controls while three players stepped their vitals.
 * The Stop Sign and "Your turn" are pinned, never an event's toast.
 */
function needsALook(event: TableEvent): boolean {
  switch (event.kind) {
    case 'proposal':
    case 'alert':
    case 'session':
    case 'downtime':
      return true
    case 'roll':
      return event.mediator === true
    default:
      return false
  }
}

/**
 * The events to toast now, oldest first, and what has been heard after them.
 *
 * The first answer (`heard` null) is history: nothing toasts, everything is
 * heard. After that an event toasts when it needs a look (`needsALook`) and is
 * new, or a rewrite changed its line (a revealed roll: the toast, keyed by the
 * event's id, updates in place). Never the viewer's own act, which their
 * screen already showed them, and never a Mediator's own copy of a roll (a
 * private or veiled one): those are the Feed's, so a hand over, which serves
 * the new Mediator every earlier one at once, replays nothing (r3 A2).
 */
export function eventsToToast(
  events: readonly TableEvent[],
  heard: Heard | null,
  viewerId: string | null
): { toast: TableEvent[]; heard: Heard } {
  const next = new Map(events.map((event) => [event._id, event.text]))
  if (heard === null) return { toast: [], heard: next }
  const toast = events
    .filter((event) => heard.get(event._id) !== event.text)
    .filter((event) => event.actorId !== viewerId)
    .filter((event) => event.private !== true && event.veiled !== true)
    // A hand over to the viewer needs their look: the notices word it ("You now mediate").
    .filter((event) => needsALook(event) || (event.kind === 'role' && event.about === viewerId))
    .sort((a, b) => a.ts - b.ts)
  // An id the stream no longer serves stays heard: a line that scrolled off never toasts again.
  return { toast, heard: new Map([...heard, ...next]) }
}

/** When the newest group session the stream holds began; 0 with none. */
function sessionStart(events: readonly TableEvent[]): number {
  return Math.max(0, ...events.filter((event) => event.session === 'start').map((e) => e.ts))
}

/**
 * The Mediator's newest alert still worth pinning: recent, not dismissed, not
 * the viewer's own, and of the session now running: one sent before the newest
 * session began ended with its own (r2 C5).
 */
export function pinnedAlert(
  events: readonly TableEvent[],
  dismissed: ReadonlySet<string>,
  viewerId: string | null,
  now: number
): TableEvent | null {
  const since = sessionStart(events)
  const alerts = events
    .filter((event) => event.kind === 'alert' && event.actorId !== viewerId)
    .filter((event) => event.ts >= since)
    .filter((event) => now - event.ts < ALERT_PINNED_MS && !dismissed.has(event._id))
    .sort((a, b) => b.ts - a.ts)
  return alerts[0] ?? null
}

/**
 * The hand over that made the viewer this Game's Mediator, while it is news:
 * the newest `role` event, about them, by someone else, recent and not
 * dismissed. Null once somebody else was appointed after them.
 */
export function pinnedRole(
  events: readonly TableEvent[],
  dismissed: ReadonlySet<string>,
  viewerId: string | null,
  now: number
): TableEvent | null {
  const last = events.filter((event) => event.kind === 'role').sort((a, b) => b.ts - a.ts)[0]
  if (last === undefined || last.about !== viewerId || last.actorId === viewerId) return null
  return now - last.ts < ROLE_PINNED_MS && !dismissed.has(last._id) ? last : null
}

/**
 * When the Game's last group session ended, while that is still news: the
 * newest session event is its end, and recent. Read off the events, so a
 * screen opened just after the end says so too. Never for whoever ended it
 * (r2 C5): it is about something they did.
 */
export function endedSession(
  events: readonly TableEvent[],
  now: number,
  viewerId: string | null = null
): number | null {
  const last = events.filter((event) => event.session !== undefined).sort((a, b) => b.ts - a.ts)[0]
  if (last === undefined || last.session !== 'end') return null
  if (viewerId !== null && last.actorId === viewerId) return null
  return now - last.ts < ALERT_PINNED_MS ? last.ts : null
}

/**
 * Whether `pathname` is one of a Game's own pages (r2 C5): its page and
 * everything under it (Mediate, Prep), or the Play screen or sheet of one of
 * the viewer's pilots in it. "Session ended" shows there and nowhere else.
 */
export function onGamePages(
  pathname: string,
  gameRoot: string,
  pilotRoots: readonly string[]
): boolean {
  const path = pathname.replace(/\/$/, '')
  return [gameRoot, ...pilotRoots].some((root) => path === root || path.startsWith(`${root}/`))
}

/**
 * Which of the viewer's pilots the Mediator marked as up now, or null (r2
 * E1): the pinned "Your turn" strip, on every Play tab and on their sheet.
 */
export function myTurn<P extends { id: string }>(
  upNow: string | undefined,
  pilots: readonly P[]
): P | null {
  return upNow === undefined ? null : (pilots.find((pilot) => pilot.id === upNow) ?? null)
}

/** The tab's title while a Stop Sign is up. */
export function pausedTitle(title: string, prefix: string): string {
  return title.startsWith(prefix) ? title : `${prefix}${title}`
}

/** The tab's title once it is lifted. */
export function resumedTitle(title: string, prefix: string): string {
  return title.startsWith(prefix) ? title.slice(prefix.length) : title
}

/** A Game as the notices remember it between two readings of the viewer's Games. */
export type KnownGame = { _id: string; name: string }

/** Games the viewer is leaving or deleting themselves: their own doing, so not announced. */
const ownLeaving = new Set<string>()

/** The viewer is leaving (or deleting) `gameId` themselves; call the answer if it did not happen. */
export function leavingOnPurpose(gameId: string): () => void {
  ownLeaving.add(gameId)
  return () => {
    ownLeaving.delete(gameId)
  }
}

/**
 * The Games the viewer was in at the last reading and is in no longer, not by
 * their own doing (r2 B4): its Organiser removed them, or deleted it. Without
 * this their Play screen just turns into a solo one.
 */
export function gamesGone(before: readonly KnownGame[], now: readonly KnownGame[]): KnownGame[] {
  const still = new Set(now.map((game) => game._id))
  return before.filter((game) => !still.has(game._id) && !ownLeaving.delete(game._id))
}
