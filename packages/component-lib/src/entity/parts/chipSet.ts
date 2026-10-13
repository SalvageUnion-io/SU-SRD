import type { StatItem } from '../../components/containers/statsBarTypes'
import type { TagItem } from './tagItems'

/**
 * Every chip an entity carries (E17), gathered once: ONE group, in this
 * order: the action type, the facts, the traits, each a horizontal `Stat`
 * cell, then the cost, the book's pointy box (`Chips`).
 */
export type ChipSet = {
  /** The action type as the book prints it ("Turn Action", "Reaction"). */
  durations: string[]
  /** The activation cost as printed ("2 EP"), when it is read, not a control. */
  cost?: string
  /** The value cells: SLOTS, TL, SV, HP, an action's RNG and DMG. */
  facts: StatItem[]
  /** The traits, `[Hot | 2]`. */
  tags: TagItem[]
}

export function chipCount(chips: ChipSet): number {
  return chips.durations.length + (chips.cost ? 1 : 0) + chips.facts.length + chips.tags.length
}

/** A cost as its chip: "2 EP" is `EP | 2`, "X AP" is `AP | X`; anything else a label alone. */
export function costCell(cost: string): { label: string; value?: string } {
  const match = /^(\S+)\s+(\S+)$/.exec(cost.trim())
  return match?.[1] && match[2] ? { label: match[2], value: match[1] } : { label: cost }
}
