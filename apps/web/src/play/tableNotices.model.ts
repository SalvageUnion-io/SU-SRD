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

/** The first "Your turn" strip's id: where "Skip to your turn" lands (r5 A17). */
export const YOUR_TURN_ID = 'su-your-turn'

/** How long the Mediator's alert stays pinned unless dismissed. */
const ALERT_PINNED_MS = 10 * 60_000

/** How long "You now mediate" stays pinned unless dismissed: long enough to be met at the next visit. */
const ROLE_PINNED_MS = 7 * 24 * 60 * 60_000

/** What a screen has already heard of one Game's events: each id's line as last toasted. */
export type Heard = ReadonlyMap<string, string>

/**
 * What a toast is kept for (r2 C4): what needs a look. A proposal, the
 * Mediator's alert, the session starting and ending, Downtime beginning and
 * ending, the Mediator's role moving, and a roll the Mediator made. Every crewmate's vitals, actions,
 * boarding, assignments and rolls go to the Feed alone: a toast for each
 * stacked over the controls while three players stepped their vitals.
 * The Stop Sign and "Your turn" are pinned, never an event's toast. A player
 * ending their own turn is the Mediator's to hear (r4 B1): the crew read it
 * on the Feed.
 */
function needsALook(event: TableEvent, mediates: boolean): boolean {
  switch (event.kind) {
    case 'turn':
      return mediates
    case 'proposal':
    case 'alert':
    case 'session':
    case 'downtime':
    // Who runs the table, for everyone at it (r3 A4): the notices word it
    // "You now mediate" for whoever it names.
    case 'role':
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
  viewerId: string | null,
  mediates = false
): { toast: TableEvent[]; heard: Heard } {
  const next = new Map(events.map((event) => [event._id, event.text]))
  if (heard === null) return { toast: [], heard: next }
  const toast = events
    .filter((event) => heard.get(event._id) !== event.text)
    .filter((event) => event.actorId !== viewerId)
    .filter((event) => event.private !== true && event.veiled !== true)
    .filter((event) => needsALook(event, mediates))
    .sort((a, b) => a.ts - b.ts)
  // An id the stream no longer serves stays heard: a line that scrolled off never toasts again.
  return { toast, heard: new Map([...heard, ...next]) }
}

/** What a Game's pinned strip is showing on this screen, as far as a toast would repeat it. */
export type PinnedNow = {
  /** The pinned alert's event id (`pinnedAlert`). */
  alertId: string | null
  /** The pinned hand over's event id (`pinnedRole`). */
  roleId: string | null
  /** "Session live" and its door are pinned: any screen but Play and the Game's own page. */
  sessionLive: boolean
  /** "Session ended" is pinned: on the Game's own pages (`onGamePages`). */
  sessionEnded: boolean
}

/**
 * Whether the pinned strip already says `event` to this viewer (r3 H2, chrome
 * K5: a notice has one job): then it is not toasted too, where on a phone the
 * toast landed over the strip with the same words. A proposal that is the
 * viewer's to answer is always pinned, with Accept and Decline.
 */
export function pinnedSays(event: TableEvent, pinned: PinnedNow, viewerId: string | null): boolean {
  switch (event.kind) {
    case 'alert':
      return event._id === pinned.alertId
    case 'role':
      return event._id === pinned.roleId
    case 'proposal':
      return viewerId !== null && event.about === viewerId
    case 'session':
      return event.session === 'start'
        ? pinned.sessionLive
        : event.session === 'end' && pinned.sessionEnded
    default:
      return false
  }
}

/** When the newest group session the stream holds began; 0 with none. */
function sessionStart(events: readonly TableEvent[]): number {
  return Math.max(0, ...events.filter((event) => event.session === 'start').map((e) => e.ts))
}

/** When the newest group session the stream holds ended; 0 with none. */
function sessionEnd(events: readonly TableEvent[]): number {
  return Math.max(0, ...events.filter((event) => event.session === 'end').map((e) => e.ts))
}

/** When the viewer joined the Game, as the stream says it; 0 when that line is gone. */
function joinedAt(events: readonly TableEvent[], viewerId: string | null): number {
  const joins = events.filter((event) => event.kind === 'join' && event.actorId === viewerId)
  return Math.max(0, ...joins.map((e) => e.ts))
}

/**
 * The Mediator's newest alert still worth pinning: recent, not dismissed, not
 * the viewer's own, and of the session now running. One sent before the newest
 * session began ended with its own (r2 C5); one the session has ended since is
 * done with it; and one sent before the viewer joined was never said to them
 * (r3 H1).
 */
export function pinnedAlert(
  events: readonly TableEvent[],
  dismissed: ReadonlySet<string>,
  viewerId: string | null,
  now: number
): TableEvent | null {
  const since = Math.max(sessionStart(events), sessionEnd(events), joinedAt(events, viewerId))
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
 * (r2 C5): it is about something they did. Never for someone who joined
 * after it ended, who was not there for it, and never on a later day than
 * it ended (r4 B5): it does not outstay the night.
 */
export function endedSession(
  events: readonly TableEvent[],
  now: number,
  viewerId: string | null = null
): number | null {
  const last = events.filter((event) => event.session !== undefined).sort((a, b) => b.ts - a.ts)[0]
  if (last === undefined || last.session !== 'end') return null
  if (viewerId !== null && last.actorId === viewerId) return null
  if (joinedAt(events, viewerId) > last.ts || !sameDay(last.ts, now)) return null
  return now - last.ts < ALERT_PINNED_MS ? last.ts : null
}

/** Whether two moments fall on one calendar day, as the viewer's clock reads them. */
function sameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
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
 * The Game whose pages `pathname` is one of (`onGamePages`), or null on a
 * page that is no Game's: a Game's alert is never pinned over another Game's
 * pages (r3 H1).
 */
export function gameOfPage(
  pathname: string,
  games: readonly { id: string; root: string; pilotRoots: readonly string[] }[]
): string | null {
  return games.find((game) => onGamePages(pathname, game.root, game.pilotRoots))?.id ?? null
}

/**
 * One pinned notice as the strip stacks it (r3 H1). `answer` is one waiting
 * on the viewer (a proposal), `turn` their turn; neither can be dismissed.
 * `alert` is the Mediator's word to the table, which nothing folds away
 * (r4 B2).
 */
export type StackedNotice = {
  key: string
  rank: 'alert' | 'answer' | 'turn' | 'news'
  /** When it became news: the newest leads. */
  ts: number
  /** Whether Dismiss, and so Dismiss all, clears it. */
  dismissible: boolean
}

const RANK = { alert: 0, answer: 1, turn: 2, news: 3 } as const

/**
 * The notices in the order they pin (r3 H1): the Mediator's alert at the top
 * (r4 B2), then what waits on the viewer's answer, so Accept is never behind
 * anything, then their turn, then the news, newest first.
 */
export function stackNotices<N extends StackedNotice>(notices: readonly N[]): N[] {
  return [...notices].sort((a, b) => RANK[a.rank] - RANK[b.rank] || b.ts - a.ts)
}

/**
 * What the pinned notices show and what waits behind the count (r4 B2): every
 * alert, each a strip of its own above the rest and never counted, for the
 * player who is up as for anyone; then the first of the others, which is the
 * one strip (r3 H1), with the rest behind its button. "Your turn" is never
 * behind the count (r5 A5): under a proposal it is a line of its own (`turns`).
 */
export function shownNotices<N extends StackedNotice>(
  notices: readonly N[]
): { alerts: N[]; top: N | null; turns: N[]; rest: N[] } {
  const ordered = stackNotices(notices)
  const [top = null, ...others] = ordered.filter((notice) => notice.rank !== 'alert')
  return {
    alerts: ordered.filter((notice) => notice.rank === 'alert'),
    top,
    turns: others.filter((notice) => notice.rank === 'turn'),
    rest: others.filter((notice) => notice.rank !== 'turn'),
  }
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

/** Games whose Mediator role the viewer is handing on themselves: their own doing, so not announced. */
const ownStandingDown = new Set<string>()

/** The viewer is handing `gameId`'s Mediator role on themselves; call the answer if it did not happen. */
export function standingDownOnPurpose(gameId: string): () => void {
  ownStandingDown.add(gameId)
  return () => {
    ownStandingDown.delete(gameId)
  }
}

/**
 * Whether the viewer just stopped mediating `gameId`, not by their own doing
 * (r3 A4): the Organiser took the role back or handed it on. Without this
 * their Mediate screen just turns into "Only this Game's Mediator".
 */
export function lostRole(before: boolean | null, now: boolean, gameId: string): boolean {
  if (before !== true || now) return false
  return !ownStandingDown.delete(gameId)
}
