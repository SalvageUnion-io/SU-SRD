/**
 * The Feed's one list (play.md §8), pure: no React and no I/O.
 *
 * In a Game it merges the table's event stream (`changeLog.events`: every
 * member's vitals, actions, boarding and rolls, the Mediator's alerts, the
 * session and the Stop Sign), the proposals awaiting my answer, and the rolls and
 * applied changes this screen recorded (`playRolls`). Solo there is no Game
 * log, so only my own. Proposals awaiting an answer come first, so Accept is
 * never scrolled away; everything else is newest first.
 *
 * My own rolls reach the Game's log too (the dispatch writes them, stamped
 * with the roll's own time), so the log's copy of a roll this screen holds is
 * dropped: the screen's copy carries its Discord post state.
 */

import { playCopy } from '../messages/play'
import type { TableEvent } from '../rooms/game/events'
import type { PlayRoll } from './playRolls.model'
import { isDiceRoll, playRollDescription } from './playRolls.model'
import { proposalChange } from './proposalAnswer.model'
import type { AlertLine, PendingProposal, RollLine } from './useGameFeed'

export type FeedEntry =
  | {
      kind: 'proposal'
      key: string
      ts: number
      proposalId: string
      /** "Bonesaw HP → 5": what it asks, and what an accepted one says it applied. */
      change: string
      /** "Mediator proposes Bonesaw HP → 5". */
      text: string
      reason: string | null
      /** The proposal itself: what an accepted one's Undo writes back. */
      proposal: PendingProposal
    }
  | { kind: 'alert'; key: string; ts: number; text: string }
  /** What a member did at the table (`rooms/game/events.ts`): a vital, an action, boarding, the session. */
  | { kind: 'event'; key: string; ts: number; text: string }
  /**
   * A crewmate's roll, from the Game's log. `reveal` is the roll's id on a
   * Mediator's copy of one the players do not read whole (ADR-051 §9b): theirs
   * to show the table. `kept` says what the players miss: all of it (a private
   * roll), or its names (a veiled one).
   */
  | { kind: 'roll'; key: string; ts: number; text: string; reveal?: string; kept?: Kept }
  /** A roll or a change made on this screen: "You · Core Mechanic · 14 · Success". */
  | {
      kind: 'mine'
      key: string
      ts: number
      text: string
      roll: PlayRoll
      reveal?: string
      kept?: Kept
    }

/** What the players miss of a roll a Mediator may reveal: the whole roll, or the names in it. */
export type Kept = 'roll' | 'names'

export type FeedSources = {
  /** The Game's rolls, newest first; null solo or while loading. */
  rolls: readonly RollLine[] | null
  alerts: readonly AlertLine[]
  /**
   * The table's event stream (`changeLog.events`), rolls and alerts included:
   * given, it is the Feed's one source and `rolls` and `alerts` are not read.
   */
  events?: readonly TableEvent[] | null
  proposals: readonly PendingProposal[]
  /** This screen's rolls and changes (`usePlayRollLog`), oldest first. */
  mine: readonly PlayRoll[]
  /** The name the Game's log gives my rolls (`playRollDescription`): to drop its copies. */
  rollerName: string
  /** The reader: a line the table attributes to the Mediator reads "You" when it is theirs. */
  viewerId?: string | null
}

/**
 * A line about the reader's own act (MD2-12, r3 A6): the table says
 * "Mediator" for an alert, a proposal, the session and Downtime, and a name
 * for whoever answered a proposal or joined; the one who did it reads "You",
 * as their rolls do.
 */
const OWN: ReadonlySet<TableEvent['kind']> = new Set([
  'alert',
  'proposal',
  'session',
  'downtime',
  'join',
])

/**
 * What follows the subject of a line the room words "<who> <did>"
 * (`rooms/game/events.ts`): the reader's own starts "You".
 */
const DID = [
  ` ${playCopy('saidStartedSession')}`,
  ` ${playCopy('saidEndedSession')}`,
  ` ${playCopy('saidBeganDowntime')}`,
  ` ${playCopy('saidEndedDowntime')}`,
  ' accepted: ',
  ' declined: ',
  ' undid: ',
  ` ${playCopy('saidJoined')}`,
] as const

function asMine(text: string): string {
  const proposes = playCopy('mediatorProposes', { what: '' })
  if (text.startsWith(proposes))
    return playCopy('youPropose', { what: text.slice(proposes.length) })
  for (const did of DID) {
    const at = text.indexOf(did)
    if (at > 0) return `${playCopy('feedYou')}${text.slice(at)}`
  }
  const mediator = `${playCopy('feedMediator')} `
  return text.startsWith(mediator) ? `${playCopy('feedYou')} ${text.slice(mediator.length)}` : text
}

/**
 * One of the table's events as `viewerId` reads its line, wherever it is
 * listed (the Feed, "Last session"): their own act says "You", and the hand
 * over that names them says "You now mediate this Game".
 */
export function tableLine(e: TableEvent, viewerId: string | null): string {
  if (viewerId === null) return e.text
  if (e.kind === 'role' && e.about === viewerId) return playCopy('youNowMediateLine')
  if (e.kind === 'roll') {
    const signed = `${playCopy('feedMediator')} · `
    return e.actorId === viewerId && e.text.startsWith(signed)
      ? `${playCopy('feedYou')} · ${e.text.slice(signed.length)}`
      : e.text
  }
  return e.actorId === viewerId && OWN.has(e.kind) ? asMine(e.text) : e.text
}

/**
 * "Bonesaw HP 7 → 5": a proposal stores no before (ADR-030 §4), so the from is
 * the sheet as the room read it when it served this (`proposalChange`).
 */
function proposalWhat(p: PendingProposal): string {
  return `${p.targetName ?? p.entityType} ${proposalChange(p)}`
}

/** What Reveal would show the table of a Mediator's copy of a roll, or nothing when it is the table's. */
function keptOf(e: TableEvent): { reveal?: string; kept?: Kept } {
  if (e.kind !== 'roll') return {}
  if (e.private === true) return { reveal: e._id, kept: 'roll' }
  return e.veiled === true ? { reveal: e._id, kept: 'names' } : {}
}

/**
 * One of my entries as its Feed line reads: "You · 120mm Cannon · 14 ·
 * Success". `hidden` is whether it is private still: a roll made private and
 * revealed since stops saying so (r3 A1).
 */
export function mineText(roll: PlayRoll, hidden = roll.private === true): string {
  return [
    'You',
    roll.label,
    ...(roll.rolls.length > 0 ? [roll.rolls.join(', ')] : []),
    ...(roll.outcome ? [roll.outcome] : []),
    ...(hidden ? [playCopy('privateRoll')] : []),
  ].join(' · ')
}

export function playFeedEntries({
  rolls,
  alerts,
  events = null,
  proposals,
  mine,
  rollerName,
  viewerId = null,
}: FeedSources): FeedEntry[] {
  const said = (e: TableEvent) => tableLine(e, viewerId)
  const echoKey = (r: PlayRoll) => `${r.at}|${playRollDescription(rollerName, r)}`
  const echoes = new Set(mine.filter(isDiceRoll).map(echoKey))
  // The log's copy of a roll this screen holds: its id is what Reveal names,
  // and it says whether the roll is private still.
  const copies = new Map(
    (events ?? []).filter((e) => e.kind === 'roll').map((e) => [`${e.ts}|${e.text}`, e])
  )
  const pending: FeedEntry[] = [...proposals]
    .sort((a, b) => b.ts - a.ts)
    .map((p) => ({
      kind: 'proposal',
      key: `proposal-${p._id}`,
      ts: p.ts,
      proposalId: p._id,
      change: proposalWhat(p),
      text: playCopy('mediatorProposes', { what: proposalWhat(p) }),
      proposal: p,
      reason: p.reason,
    }))
  // A roll of mine this screen no longer holds (made before a reload, or on
  // another screen) still reads as mine. The room says whose each event is, so
  // a roll another Mediator signed the same way is never "You" (r3 A2).
  const prefixes = [`${rollerName} · `, `${playCopy('feedMediator')} · `]
  const mineAs = (description: string, actorId?: string | null) => {
    // A roll the room names no roller for is matched by its name alone, as before.
    if (viewerId !== null && typeof actorId === 'string' && actorId !== viewerId) return description
    // Known to be mine, whatever name this screen rolls under: a Mediator's on their pilot's Play.
    const known = viewerId !== null && actorId === viewerId
    const prefix = prefixes.slice(0, known ? 2 : 1).find((p) => description.startsWith(p))
    return prefix === undefined ? description : `You · ${description.slice(prefix.length)}`
  }
  // A private roll says so on the Feeds that may read it (the Mediators').
  const rollText = (description: string, hidden: boolean | undefined, actorId?: string | null) =>
    hidden
      ? `${mineAs(description, actorId)} · ${playCopy('privateRoll')}`
      : mineAs(description, actorId)
  const logged: FeedEntry[] =
    events !== null
      ? events
          .filter((e) => e.kind !== 'roll' || !echoes.has(`${e.ts}|${e.text}`))
          .map(
            (e): FeedEntry => ({
              kind: e.kind === 'roll' || e.kind === 'alert' ? e.kind : 'event',
              key: `event-${e._id}`,
              ts: e.ts,
              text: e.kind === 'roll' ? rollText(e.text, e.private, e.actorId) : said(e),
              ...keptOf(e),
            })
          )
      : [
          ...(rolls ?? [])
            .filter((r) => !echoes.has(`${r.ts}|${r.description}`))
            .map(
              (r): FeedEntry => ({
                kind: 'roll',
                key: `roll-${r._id}`,
                ts: r.ts,
                text: rollText(r.description, r.private),
              })
            ),
          ...alerts.map(
            (a): FeedEntry => ({
              kind: 'alert',
              key: `alert-${a._id}`,
              ts: a.ts,
              text: `Mediator · ${a.message}`,
            })
          ),
        ]
  const rest: FeedEntry[] = [
    ...logged,
    ...mine.map((r): FeedEntry => {
      const copy = copies.get(echoKey(r))
      return {
        kind: 'mine',
        key: r.id,
        ts: r.at,
        text: mineText(r, copy === undefined ? r.private === true : copy.private === true),
        roll: r,
        ...(copy === undefined ? {} : keptOf(copy)),
      }
    }),
  ].sort((a, b) => b.ts - a.ts)
  return [...pending, ...rest]
}
