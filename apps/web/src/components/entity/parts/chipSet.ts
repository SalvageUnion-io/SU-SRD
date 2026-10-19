import type { StatItem } from '../../containers/statsBarTypes'
import type { TagItem } from './tagItems'

/**
 * Every chip an entity carries (E17), gathered once: ONE group, in the class
 * order (`chips-and-actions.md` C2): the rank and measures (the stats), the
 * economy (the action type, then the action's facts), the traits, the
 * relations (C11), each a horizontal `Stat` cell, then the cost, the book's
 * pointy box (`Chips`). The host's marks lead it; its slots follow the cost.
 */
export type ChipSet = {
  /** The action type as the book prints it ("Turn Action", "Reaction"). */
  durations: string[]
  /** The activation cost as printed ("2 EP"), when it is read, not a control. */
  cost?: string
  /**
   * The value cells, in the stat order: the rank (the Tech Level, keyed
   * `tech-level`), the measures (SLOTS, SV, SP or HP), then an action's facts
   * (RNG, DMG). `splitStatLine` cuts them where the action starts.
   */
  facts: StatItem[]
  /** The traits, `[Hot | 2]`. */
  tags: TagItem[]
  /** What it is built on or linked to, `CHASSIS | Mule`, `PILOT | Bonesaw` (C11). */
  relations?: TagItem[]
}

/**
 * The chip classes in their one order (C2): the read chips, mark through
 * cost, then the slots (C8) that follow the cost: a state (a live reading, a
 * condition, a quantity), uses, and the "⋯" menu or ✕. Every chip sits in
 * its class's lane, `data-chip-class` (C2a).
 */
export const CHIP_CLASSES = [
  'mark',
  'rank',
  'measure',
  'economy',
  'traits',
  'relation',
  'cost',
  'state',
  'uses',
  'menu',
] as const

export type ChipClass = (typeof CHIP_CLASSES)[number]

/** A fact that ranks its entity: the Tech Level (a class's kind where it has none). */
export const RANK_KEY = 'tech-level'

export function chipCount(chips: ChipSet): number {
  return (
    chips.durations.length +
    (chips.cost ? 1 : 0) +
    chips.facts.length +
    chips.tags.length +
    (chips.relations?.length ?? 0)
  )
}

/** A cost as its chip: "2 EP" is `EP | 2`, "X AP" is `AP | X`; anything else a label alone. */
export function costCell(cost: string): { label: string; value?: string } {
  const match = /^(\S+)\s+(\S+)$/.exec(cost.trim())
  return match?.[1] && match[2] ? { label: match[2], value: match[1] } : { label: cost }
}
