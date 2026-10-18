/**
 * The Feed's one list (play.md §8), pure: no React and no I/O.
 *
 * In a Game it merges the crew's rolls (`changeLog.rolls`, the Game's log),
 * the Mediator's alerts, the proposals awaiting my answer, and the rolls and
 * applied changes this screen recorded (`playRolls`). Solo there is no Game
 * log, so only my own. Proposals awaiting an answer come first, so Accept is
 * never scrolled away; everything else is newest first.
 *
 * My own rolls reach the Game's log too (the dispatch writes them, stamped
 * with the roll's own time), so the log's copy of a roll this screen holds is
 * dropped: the screen's copy carries its Discord post state.
 */

import { fieldLabel } from 'game-domain/games/proposals'
import type { PlayRoll } from './playRolls.model'
import { isDiceRoll, playRollDescription } from './playRolls.model'
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
    }
  | { kind: 'alert'; key: string; ts: number; text: string }
  /** A crewmate's roll, from the Game's log. */
  | { kind: 'roll'; key: string; ts: number; text: string }
  /** A roll or a change made on this screen: "You · Core Mechanic · 14 · Success". */
  | { kind: 'mine'; key: string; ts: number; text: string; roll: PlayRoll }

type FeedSources = {
  /** The Game's rolls, newest first; null solo or while loading. */
  rolls: readonly RollLine[] | null
  alerts: readonly AlertLine[]
  proposals: readonly PendingProposal[]
  /** This screen's rolls and changes (`usePlayRollLog`), oldest first. */
  mine: readonly PlayRoll[]
  /** The name the Game's log gives my rolls (`playRollDescription`): to drop its copies. */
  rollerName: string
}

function show(value: unknown): string {
  return value === null || value === undefined ? '—' : String(value)
}

/** "Bonesaw HP → 5": a proposal stores no before (ADR-030 §4), so only what it asks. */
function proposalChange(p: PendingProposal): string {
  return `${p.targetName ?? p.entityType} ${fieldLabel(p.field)} → ${show(p.after)}`
}

/** One of my entries as its Feed line reads: "You · 120mm Cannon · 14 · Success". */
export function mineText(roll: PlayRoll): string {
  return [
    'You',
    roll.label,
    ...(roll.rolls.length > 0 ? [roll.rolls.join(', ')] : []),
    ...(roll.outcome ? [roll.outcome] : []),
  ].join(' · ')
}

export function playFeedEntries({
  rolls,
  alerts,
  proposals,
  mine,
  rollerName,
}: FeedSources): FeedEntry[] {
  const echoes = new Set(
    mine.filter(isDiceRoll).map((r) => `${r.at}|${playRollDescription(rollerName, r)}`)
  )
  const pending: FeedEntry[] = [...proposals]
    .sort((a, b) => b.ts - a.ts)
    .map((p) => ({
      kind: 'proposal',
      key: `proposal-${p._id}`,
      ts: p.ts,
      proposalId: p._id,
      change: proposalChange(p),
      text: `Mediator proposes ${proposalChange(p)}`,
      reason: p.reason,
    }))
  // A roll of mine this screen no longer holds (made before a reload, or on
  // another screen) still reads as mine.
  const myPrefix = `${rollerName} · `
  const rest: FeedEntry[] = [
    ...(rolls ?? [])
      .filter((r) => !echoes.has(`${r.ts}|${r.description}`))
      .map(
        (r): FeedEntry => ({
          kind: 'roll',
          key: `roll-${r._id}`,
          ts: r.ts,
          text: r.description.startsWith(myPrefix)
            ? `You · ${r.description.slice(myPrefix.length)}`
            : r.description,
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
    ...mine.map(
      (r): FeedEntry => ({ kind: 'mine', key: r.id, ts: r.at, text: mineText(r), roll: r })
    ),
  ].sort((a, b) => b.ts - a.ts)
  return [...pending, ...rest]
}
