/**
 * The Feed's one list (play.md §8), pure: no React and no I/O.
 *
 * In a Game it merges the table's event stream (`changeLog.events`: every
 * member's vitals, actions, boarding and rolls, the Mediator's alerts, the
 * session and the Stop Sign), the proposals awaiting my answer, and the rolls and
 * applied changes this screen recorded (`playRolls`). Solo there is no Game
 * log, so only my own. Proposals awaiting an answer come first, so Accept is
 * never scrolled away; everything else is newest first. A proposal still
 * awaiting my answer is that one entry: the table's line for it ("Mediator
 * proposes …") is left out until it is answered (r4 B5).
 *
 * My own rolls reach the Game's log too (the dispatch writes them, stamped
 * with the roll's own time), so the log's copy of a roll this screen holds is
 * dropped: the screen's copy carries its Discord post state.
 *
 * One action is one entry (r5 A9): "Razor uses Red Laser", the cost it paid
 * ("Thresher (Razor) · Heat 0 → 1") and its roll group under the roll, or
 * under the use where nothing was rolled (`lead`, `detail`). And my own
 * change this screen wrote ("You · Hotdog · HP 10→0 · roll on …") is not said
 * twice: the table's line for the same change is left out.
 */

import type { HeatCheckEffect, OverloadTable } from 'salvageunion-reference/rules'
import { describeOverloadOutcome } from 'salvageunion-reference/rules'
import type { LogChange } from '../build/sheet/changeLog.model'
import { playCopy } from '../messages/play'
import type { TableEvent } from '../rooms/game/events'
import type { PlayRoll } from './playRolls.model'
import { isDiceRoll, playRollDescription } from './playRolls.model'
import { proposalChange } from './proposalAnswer.model'
import type { AlertLine, PendingProposal, RollLine } from './useGameFeed'

/** An action's use and its cost, grouped into its roll's entry (r5 A9). */
type Grouped = {
  /** The use the entry is the roll of: "Razor uses Red Laser". */
  lead?: string
  /** What the action spent, a line each. */
  detail?: readonly string[]
}

export type FeedEntry = (
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
  | { kind: 'alert'; key: string; ts: number; text: string; own?: true }
  /**
   * What a member did at the table (`rooms/game/events.ts`): a vital, an
   * action, boarding, the session. `own` on the reader's own act, here and on
   * an alert and a roll: no news to them (`feedMark.model.ts`).
   */
  | { kind: 'event'; key: string; ts: number; text: string; own?: true }
  /**
   * A crewmate's roll, from the Game's log. `reveal` is the roll's id on a
   * Mediator's copy of one the players do not read whole (ADR-051 §9b): theirs
   * to show the table. `kept` says what the players miss: all of it (a private
   * roll), or its names (a veiled one).
   */
  | {
      kind: 'roll'
      key: string
      ts: number
      text: string
      reveal?: string
      kept?: Kept
      own?: true
    }
  /**
   * Solo, a line of the last visit, from the units' Change Logs (r7 A8):
   * "Thresher · Heat 0→2". `first` heads the run with "Last time".
   */
  | { kind: 'last'; key: string; ts: number; text: string; first?: true }
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
) &
  Grouped

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
  /** Solo, the last visit's lines (`lastVisitLines`), newest first: under this visit's (r7 A8). */
  last?: readonly LastLine[]
}

/** A line of the last solo visit (r7 A8). */
export type LastLine = { key: string; ts: number; text: string }

/** A pause this long between two of Play's writes ends a visit (r7 A8). */
const VISIT_GAP_MS = 3 * 60 * 60_000

/** The most lines "Last time" lists. */
const LAST_LINES = 30

/**
 * The last solo visit, as the units' Change Logs keep it (r7 A8): Play's
 * changes before `before` (this visit's first line), back to a pause of
 * `VISIT_GAP_MS`, newest first, a line each: "Thresher · Heat 0→2 · Push".
 */
export function lastVisitLines(
  units: readonly { name: string; changes: readonly LogChange[] }[],
  before: number
): LastLine[] {
  const all = units
    .flatMap(({ name, changes }) =>
      changes
        .filter((change) => change.from === 'play' && change.ts < before)
        .map((change) => ({ name, change }))
    )
    .sort((a, b) => b.change.ts - a.change.ts)
  const visit: typeof all = []
  for (const each of all) {
    const last = visit.at(-1)
    if (last !== undefined && last.change.ts - each.change.ts > VISIT_GAP_MS) break
    visit.push(each)
  }
  return visit.slice(0, LAST_LINES).map(({ name, change }) => {
    const said = change.lines.map((line) =>
      'text' in line
        ? line.text
        : `${line.label.replace(/^Current /, '')} ${line.before}→${line.after}`
    )
    return {
      key: `last:${change.id}`,
      ts: change.ts,
      text: [name, ...said, ...(change.did ? [change.did] : [])].join(' · '),
    }
  })
}

/**
 * A line about the reader's own act (MD2-12, r3 A6): the table says
 * "Mediator" for an alert, a proposal, the session and Downtime, and a name
 * for whoever answered a proposal or joined; the one who did it reads "You",
 * as their rolls do.
 */
const OWN: ReadonlySet<TableEvent['kind']> = new Set([
  'alert',
  'withdrawn',
  'proposal',
  'session',
  'downtime',
  'join',
  'stop',
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
  ` ${playCopy('saidLiftedStop')}`,
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
 * A seat's act the room words "<unit> <does>" (`rooms/game/events.ts`), as
 * its player reads it (r7 A5): "You use Red Laser", as their rolls say "You".
 */
const SEAT_ACTS: readonly [RegExp, string][] = [
  [/^.+? boards (.+)$/, 'You board $1'],
  [/^.+? climbs out, on foot$/, 'You climb out, on foot'],
  [/^.+? ejects$/, 'You eject'],
  [/^.+? uses (.+)$/, 'You use $1'],
  [/^.+? switches (.+)$/, 'You switch $1'],
  [/^.+? ended their turn$/, 'You ended your turn'],
  [/^.+? moved their Scrap$/, 'You moved your Scrap'],
  [/^.+? · (.+: not applied)$/, 'You · $1'],
]

/** The seat acts a player's own line is reworded in. */
const SEAT_KINDS: ReadonlySet<TableEvent['kind']> = new Set(['board', 'action', 'turn', 'downtime'])

function asMyAct(text: string): string {
  for (const [said, mine] of SEAT_ACTS) if (said.test(text)) return text.replace(said, mine)
  return text
}

/**
 * One of the table's events as `viewerId` reads its line, wherever it is
 * listed (the Feed, "Last session"): their own act says "You", and the hand
 * over that names them says "You now mediate this Game".
 */
export function tableLine(e: TableEvent, viewerId: string | null): string {
  if (viewerId === null) return e.text
  if (e.kind === 'role' && e.about === viewerId) return playCopy('youNowMediateLine')
  if (e.kind === 'leave' && e.about === viewerId) return playCopy('youWereRemovedLine')
  if (e.kind === 'roll') {
    const signed = `${playCopy('feedMediator')} · `
    return e.actorId === viewerId && e.text.startsWith(signed)
      ? `${playCopy('feedYou')} · ${e.text.slice(signed.length)}`
      : e.text
  }
  if (e.actorId !== viewerId) return e.text
  if (OWN.has(e.kind)) return asMine(e.text)
  return SEAT_KINDS.has(e.kind) ? asMyAct(e.text) : e.text
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

/**
 * What a Push's Heat Check came to, as its own Feed line says it (r7 A5):
 * "Passed", or "Failed" with the Reactor Overload row and what it did
 * (Core Book p.234), never a second roll of the weapon.
 */
export function heatCheckSays(effect: HeatCheckEffect, table: OverloadTable): string {
  if (!effect.result.overloaded) return playCopy('heatCheckPassed')
  const outcome = describeOverloadOutcome(effect.result, table).replace(/^Overload\. /, '')
  return `${playCopy('heatCheckFailed')} · ${outcome}`
}

/** How long after an action's use its cost and roll still group with it. */
const ACTION_SPAN_MS = 5 * 60_000

/** A vital an action's cost moves, as the table's line names it. */
const COST_LINE = / · (Heat|EP|AP|Uses) /

/** What the grouping needs of an entry: whose act, and what kind of line. */
type Source = { actor: string | null; kind: TableEvent['kind'] | 'mine' }

/**
 * Fold each action's cost and roll into one entry (r5 A9). `entries` are
 * newest first; `sources` says whose each is. A use groups the same actor's
 * cost lines (Heat, EP, AP, Uses) and the first roll naming the action, within
 * `ACTION_SPAN_MS` after it; the roll is the entry, the use its `lead`.
 */
function groupActions(
  entries: readonly FeedEntry[],
  sources: ReadonlyMap<string, Source>
): FeedEntry[] {
  const folded = new Set<string>()
  const grouped = new Map<string, FeedEntry>()
  // Oldest first, so a use claims what came after it.
  for (const use of [...entries].reverse()) {
    const from = sources.get(use.key)
    // "Razor uses Red Laser", or the player's own "You use Red Laser" (r7 A5).
    const name = from?.kind === 'action' ? / uses? (.+)$/.exec(use.text)?.[1] : undefined
    if (from === undefined || name === undefined || folded.has(use.key)) continue
    const mine = (e: FeedEntry) => e.key !== use.key && sources.get(e.key)?.actor === from.actor
    // The span ends at the same actor's next use.
    const next = [...entries]
      .reverse()
      .find((e) => mine(e) && e.ts >= use.ts && sources.get(e.key)?.kind === 'action')
    const end = Math.min(use.ts + ACTION_SPAN_MS, next?.ts ?? Number.POSITIVE_INFINITY)
    const after = (e: FeedEntry) => !folded.has(e.key) && mine(e) && e.ts >= use.ts && e.ts <= end
    const rolled = [...entries]
      .reverse()
      .find(
        (e) =>
          after(e) &&
          (e.kind === 'roll' || (e.kind === 'mine' && e.roll.rolls.length > 0)) &&
          e.text.includes(` · ${name} · `)
      )
    const until = rolled?.ts ?? end
    const costs = entries.filter(
      (e) =>
        after(e) && e.ts <= until && sources.get(e.key)?.kind === 'vitals' && COST_LINE.test(e.text)
    )
    if (rolled === undefined && costs.length === 0) continue
    const detail = costs.reverse().map((e) => e.text)
    for (const e of costs) folded.add(e.key)
    if (rolled === undefined) {
      grouped.set(use.key, { ...use, detail })
      continue
    }
    folded.add(use.key)
    grouped.set(rolled.key, { ...rolled, lead: use.text, detail })
  }
  return entries.filter((e) => !folded.has(e.key)).map((e) => grouped.get(e.key) ?? e)
}

/** How near in time the table's line for my own change and this screen's are. */
const SAME_CHANGE_MS = 10_000

export function playFeedEntries({
  rolls,
  alerts,
  events = null,
  proposals,
  mine,
  rollerName,
  viewerId = null,
  last = [],
}: FeedSources): FeedEntry[] {
  const said = (e: TableEvent) => tableLine(e, viewerId)
  const echoKey = (r: PlayRoll) => `${r.at}|${playRollDescription(rollerName, r)}`
  // A line in a slot reaches the log without dice (r6 D3), so its copy is an echo too.
  const echoes = new Set(mine.filter((r) => isDiceRoll(r) || r.slot !== undefined).map(echoKey))
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
  // The table's line for a proposal still awaiting my answer: the entry with
  // Accept and Decline says it (r4 B5). The room stamps both with one time.
  const awaiting = new Set(proposals.map((p) => p.ts))
  const proposes = playCopy('mediatorProposes', { what: '' })
  const asked = (e: TableEvent) =>
    e.kind === 'proposal' && awaiting.has(e.ts) && e.text.startsWith(proposes)
  // My own change this screen wrote says itself: the table's line for it is not said twice (r5 A9).
  const changes = mine.filter((r) => !isDiceRoll(r))
  const saidHere = (e: TableEvent) =>
    e.kind === 'vitals' &&
    viewerId !== null &&
    e.actorId === viewerId &&
    changes.some((r) => Math.abs(r.at - e.ts) <= SAME_CHANGE_MS)
  const sources = new Map<string, Source>()
  for (const e of events ?? []) sources.set(`event-${e._id}`, { actor: e.actorId, kind: e.kind })
  for (const r of mine) sources.set(r.id, { actor: viewerId, kind: 'mine' })
  const logged: FeedEntry[] =
    events !== null
      ? events
          .filter((e) => !asked(e))
          .filter((e) => !saidHere(e))
          .filter((e) => e.kind !== 'roll' || !echoes.has(`${e.ts}|${e.text}`))
          .map(
            (e): FeedEntry => ({
              kind: e.kind === 'roll' || e.kind === 'alert' ? e.kind : 'event',
              key: `event-${e._id}`,
              ts: e.ts,
              text: e.kind === 'roll' ? rollText(e.text, e.private, e.actorId) : said(e),
              ...keptOf(e),
              ...(viewerId !== null && e.actorId === viewerId ? { own: true as const } : {}),
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
  const lastTime = last.map(
    (line, i): FeedEntry => ({
      kind: 'last',
      ...line,
      ...(i === 0 ? { first: true as const } : {}),
    })
  )
  return [...pending, ...(events === null ? rest : groupActions(rest, sources)), ...lastTime]
}
