/**
 * What a member is told about their Games wherever they are in the app
 * (play.md §19), pure: which of the table's events a screen toasts, and which
 * alerts the pinned banner still shows.
 *
 * The stream is the room's (`rooms/game/events.ts`), the Feed's own source,
 * so a toast and its Feed line are the same event.
 */

import type { TableEvent } from '../rooms/game/events'

/** How long the Mediator's alert stays pinned unless dismissed. */
const ALERT_PINNED_MS = 10 * 60_000

/** What a screen has already heard of one Game's events: each id's line as last toasted. */
export type Heard = ReadonlyMap<string, string>

/**
 * The events to toast now, oldest first, and what has been heard after them.
 *
 * The first answer (`heard` null) is history: nothing toasts, everything is
 * heard. After that an event toasts when it is new, or when a merged repeat
 * rewrote its line (the toast, keyed by the event's id, updates in place).
 * Never the viewer's own act, which their screen already showed them, nor a
 * Stop Sign event, which the pinned banner says to everyone, its shower
 * included, nor an assignment taken from the viewer, which their screen says
 * in its own words (`assignmentNotices`, MD-23).
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
    .filter((event) => event.kind !== 'stop' && event.actorId !== viewerId)
    // An assignment taken from the viewer: `assignmentNotices` tells them, once.
    .filter((event) => event.about === undefined || event.about !== viewerId)
    .sort((a, b) => a.ts - b.ts)
  // An id the stream no longer serves stays heard: a line that scrolled off never toasts again.
  return { toast, heard: new Map([...heard, ...next]) }
}

/** The Mediator's newest alert still worth pinning: recent, not dismissed, not the viewer's own. */
export function pinnedAlert(
  events: readonly TableEvent[],
  dismissed: ReadonlySet<string>,
  viewerId: string | null,
  now: number
): TableEvent | null {
  const alerts = events
    .filter((event) => event.kind === 'alert' && event.actorId !== viewerId)
    .filter((event) => now - event.ts < ALERT_PINNED_MS && !dismissed.has(event._id))
    .sort((a, b) => b.ts - a.ts)
  return alerts[0] ?? null
}

/**
 * When the Game's last group session ended, while that is still news: the
 * newest session event is its end, and recent. Read off the events, so a
 * screen opened just after the end says so too.
 */
export function endedSession(events: readonly TableEvent[], now: number): number | null {
  const last = events.filter((event) => event.session !== undefined).sort((a, b) => b.ts - a.ts)[0]
  if (last === undefined || last.session !== 'end') return null
  return now - last.ts < ALERT_PINNED_MS ? last.ts : null
}

/** The tab's title while a Stop Sign is up. */
export function pausedTitle(title: string, prefix: string): string {
  return title.startsWith(prefix) ? title : `${prefix}${title}`
}

/** The tab's title once it is lifted. */
export function resumedTitle(title: string, prefix: string): string {
  return title.startsWith(prefix) ? title.slice(prefix.length) : title
}
