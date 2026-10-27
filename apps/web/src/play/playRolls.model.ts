/**
 * playRolls.model — the one place a roll made anywhere in Play is recorded
 * (play.md §8): an Action's roll, a Reactor's Heat check, a table rolled from
 * the Tables column. `recordPlayRoll(roll)` puts it on this screen's roll log
 * (the Actions column wraps its dice in `reportingRoll`, which calls it);
 * the Feed lists it (`usePlayRollLog`) and the side column's dispatch
 * (`usePlayRollDispatch`) does the rest, once per roll:
 *
 *  - in a Game, writes it to the Game's log (`changeLog`, the row
 *    `rollLogEntry` makes), so the crew's Feeds show it;
 *  - posts it to the bound Discord channel (`channelBindings.postRoll`, §9)
 *    when the screen's Post toggle, or the roll's own `post`, says so, and
 *    shows what happened on its Feed line, a failure included.
 *
 * A roll with no dice (`rolls: []`) is an applied change ("Vent · Heat 6→0,
 * Vulnerable", an accepted proposal): it lists on the Feed and goes nowhere
 * else (`recordPlayChange`).
 *
 * In memory only, for the open tab: the Game's log is the record, and a solo
 * screen's rolls are its own. No React here but the one hook.
 */

import { useSyncExternalStore } from 'react'
import type { Roll } from 'salvageunion-reference/rules'
import { coreRollBand, coreRollBandLabel } from 'salvageunion-reference/rules'
import { PLAY_TXN } from '../replica/provenance'

/** One roll as Play records it. */
export type PlayRoll = {
  /** Set by `recordPlayRoll`: the Feed's key and the dispatch's. */
  id: string
  /** The roll table's name, as the bot's card prints it ("Core Mechanic"); '' for a change. */
  tableName: string
  /** The dice, 1–20 each: one, or two for a Push or a two-column table. Empty for a change. */
  rolls: number[]
  /** What was rolled for, as the Feed reads it: "120mm Cannon", "Core Mechanic". */
  label: string
  /** What it came to: "Success", the table row's text. */
  outcome?: string
  /** When, in ms. */
  at: number
  /** This roll's own Post choice, over the screen's toggle; absent follows the toggle. */
  post?: boolean
}

/** What a caller hands `recordPlayRoll`: the id is assigned, `at` defaults to now. */
export type PlayRollInput = Omit<PlayRoll, 'id' | 'at'> & { at?: number }

type Listener = (roll: PlayRoll) => void

let log: readonly PlayRoll[] = []
let next = 0
const listeners = new Set<Listener>()
const watchers = new Set<() => void>()

/** Record a roll made in Play: it lands on the Feed, the Game's log and, if asked, Discord. */
export function recordPlayRoll(input: PlayRollInput): PlayRoll {
  next += 1
  const roll: PlayRoll = { ...input, id: `play-roll-${next}`, at: input.at ?? Date.now() }
  log = [...log, roll]
  for (const listener of listeners) listener(roll)
  for (const watch of watchers) watch()
  return roll
}

/** Record an applied change (no dice): the Feed lists it, nothing is posted. */
export function recordPlayChange(label: string, at?: number): PlayRoll {
  return recordPlayRoll({ tableName: '', rolls: [], label, ...(at === undefined ? {} : { at }) })
}

/** Whether a recorded entry is a roll (dice) rather than an applied change. */
export function isDiceRoll(roll: Pick<PlayRoll, 'rolls'>): boolean {
  return roll.rolls.length > 0
}

/**
 * The line the Game's log carries for a roll: who, what for, the dice, what it
 * came to ("Bonesaw · Core Mechanic · 14 · Success").
 */
export function playRollDescription(rollerName: string, roll: PlayRoll): string {
  return [
    rollerName,
    roll.label,
    ...(roll.rolls.length > 0 ? [roll.rolls.join(', ')] : []),
    ...(roll.outcome ? [roll.outcome] : []),
  ].join(' · ')
}

/**
 * Hear each roll as it is recorded, once: the dispatch's hook. Returns the
 * unsubscribe. Not for rendering; `usePlayRollLog` is.
 */
export function onPlayRoll(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function subscribe(watch: () => void): () => void {
  watchers.add(watch)
  return () => {
    watchers.delete(watch)
  }
}

function snapshot(): readonly PlayRoll[] {
  return log
}

/** The rolls recorded in this tab, oldest first. */
export function usePlayRollLog(): readonly PlayRoll[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/** What a reported roll says about itself besides its table and dice, read when it lands. */
export type PlayRollMeta = Pick<PlayRollInput, 'label' | 'outcome' | 'post'>

/** The Core Mechanic's band for a die ("Success"), the outcome a Core roll reports. */
function coreOutcome(die: number | undefined): string | undefined {
  return die === undefined ? undefined : coreRollBandLabel(coreRollBand(die))
}

/**
 * A rules `Roll` that records itself (`recordPlayRoll`): every die it reads is
 * kept, and once the caller has read them all (the rules read a roll
 * synchronously) it is recorded once, with every die. `meta` is read then, so
 * a caller that works out what the roll came to in the same tick (a Heat
 * Check's text, a rumour) hands it over as `outcome`; a Core Mechanic roll
 * with none reports its band.
 */
export function reportingRoll(roll: Roll, tableName: string, meta: () => PlayRollMeta): Roll {
  let dice: number[] | null = null
  return (sides) => {
    const value = roll(sides)
    if (dice === null) {
      const read: number[] = []
      dice = read
      queueMicrotask(() => {
        dice = null
        const said = meta()
        const outcome =
          said.outcome ?? (tableName === 'Core Mechanic' ? coreOutcome(read[0]) : undefined)
        recordPlayRoll({
          tableName,
          rolls: read,
          label: said.label,
          ...(outcome === undefined ? {} : { outcome }),
          ...(said.post === undefined ? {} : { post: said.post }),
        })
      })
    }
    dice.push(value)
    return value
  }
}

/** Empty the log (tests). */
export function clearPlayRolls(): void {
  log = []
  for (const watch of watchers) watch()
}

/** A roll as the Game's log keeps it: the Feed reads `description`, `result` keeps the numbers. */
export type LoggedRoll = {
  /** The line the crew reads, e.g. "Rook · Crush: 14, Success". */
  description: string
  /** The die face, where one die decided it (a table names its row in `outcome`). */
  result: { kind: 'core' | 'table'; roll: number | null; outcome: string }
}

/**
 * The change-log row a roll becomes on the Game's log (ADR-038 §2):
 * `entityType 'game'`, `field 'roll'`, Play's tag (`PLAY_TXN`), the shape
 * Discord rolls were logged in, so `changeLog.rolls` reads every roll back
 * whichever surface made it. Pure, for the round-trip test; generic so a
 * Game id passes through as itself.
 */
export function rollLogEntry<GameId extends string>(gameId: GameId, roll: LoggedRoll, ts: number) {
  return {
    gameId,
    entityType: 'game' as const,
    entityId: gameId,
    ts,
    kind: PLAY_TXN.kind,
    field: 'roll',
    before: null,
    after: { description: roll.description, result: roll.result },
    source: PLAY_TXN.source,
  }
}
