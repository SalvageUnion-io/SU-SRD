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
import { proposalChange } from './proposalAnswer'
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
   * Mediator's copy of a veiled one (ADR-051 §9b): theirs to show the table.
   */
  | { kind: 'roll'; key: string; ts: number; text: string; reveal?: string }
  /** A roll or a change made on this screen: "You · Core Mechanic · 14 · Success". */
  | { kind: 'mine'; key: string; ts: number; text: string; roll: PlayRoll; reveal?: string }

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
}

/**
 * "Bonesaw HP 7 → 5": a proposal stores no before (ADR-030 §4), so the from is
 * the sheet as the room read it when it served this (`proposalChange`).
 */
function proposalWhat(p: PendingProposal): string {
  return `${p.targetName ?? p.entityType} ${proposalChange(p)}`
}

/** One of my entries as its Feed line reads: "You · 120mm Cannon · 14 · Success". */
export function mineText(roll: PlayRoll): string {
  return [
    'You',
    roll.label,
    ...(roll.rolls.length > 0 ? [roll.rolls.join(', ')] : []),
    ...(roll.outcome ? [roll.outcome] : []),
    ...(roll.private ? [playCopy('privateRoll')] : []),
  ].join(' · ')
}

export function playFeedEntries({
  rolls,
  alerts,
  events = null,
  proposals,
  mine,
  rollerName,
}: FeedSources): FeedEntry[] {
  const echoKey = (r: PlayRoll) => `${r.at}|${playRollDescription(rollerName, r)}`
  const echoes = new Set(mine.filter(isDiceRoll).map(echoKey))
  // The log's copy of a veiled roll this screen holds: its id is what Reveal names.
  const veiledEchoes = new Map(
    (events ?? [])
      .filter((e) => e.kind === 'roll' && e.veiled === true)
      .map((e) => [`${e.ts}|${e.text}`, e._id])
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
  // another screen) still reads as mine.
  const myPrefix = `${rollerName} · `
  const mineAs = (description: string) =>
    description.startsWith(myPrefix) ? `You · ${description.slice(myPrefix.length)}` : description
  // A private roll says so on the Feeds that may read it (the Mediators').
  const rollText = (description: string, hidden: boolean | undefined) =>
    hidden ? `${mineAs(description)} · ${playCopy('privateRoll')}` : mineAs(description)
  const logged: FeedEntry[] =
    events !== null
      ? events
          .filter((e) => e.kind !== 'roll' || !echoes.has(`${e.ts}|${e.text}`))
          .map(
            (e): FeedEntry => ({
              kind: e.kind === 'roll' || e.kind === 'alert' ? e.kind : 'event',
              key: `event-${e._id}`,
              ts: e.ts,
              text: e.kind === 'roll' ? rollText(e.text, e.private) : e.text,
              ...(e.kind === 'roll' && e.veiled === true ? { reveal: e._id } : {}),
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
      const reveal = veiledEchoes.get(echoKey(r))
      return {
        kind: 'mine',
        key: r.id,
        ts: r.at,
        text: mineText(r),
        roll: r,
        ...(reveal === undefined ? {} : { reveal }),
      }
    }),
  ].sort((a, b) => b.ts - a.ts)
  return [...pending, ...rest]
}
