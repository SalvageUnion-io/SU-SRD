import type { MiniChips } from 'salvageunion-reference'
import type { StatItem } from '../../containers/statsBarTypes'
import { actionTypeStamps } from './actionStamps'
import type { ChipSet } from './chipSet'
import { RANK_KEY } from './chipSet'
import type { TagItem } from './tagItems'

/**
 * A Mini's chips (`chips-and-actions.md`, C3 and C4) as a `ChipSet`: the
 * model's `tokenChips` for the context its container names. The rank and the
 * context lane are cells in the stat order (a loadout's Slots or SP, a
 * roster's lead vital, a thing you do's action type or `ACTIONS | n`), then a
 * contentful Mini's economy, facets and traits (N3), then the cost. A
 * quantity (`× | 3`) is a state, after the cost (C2).
 */
export function tokenChipSet(
  chips: MiniChips,
  cost: string | undefined
): {
  set: ChipSet
  quantity?: StatItem
} {
  const facts: StatItem[] = []
  const durations: string[] = []
  let quantity: StatItem | undefined
  if (chips.rank)
    facts.push({
      key: RANK_KEY,
      label: chips.rank.label,
      value: chips.rank.value,
      group: 'provenance',
    })
  for (const [index, lane] of [chips.lane, chips.economy].entries()) {
    if (lane?.kind === 'actionType') {
      durations.push(...actionTypeStamps(lane.actionType, lane.mechActionType))
    } else if (lane?.kind === 'cell') {
      const { label, value } = lane.cell
      if (label === '×') quantity = { key: 'quantity', label, value }
      // The context lane's measure (Slots, SP, HP) is a stat; `ACTIONS | n` is economy.
      else if (index === 0 && label !== 'Actions')
        facts.push({ key: `lane-${label}`, label, value, group: 'vitals' })
      else facts.push({ key: `economy-${label}`, label, value, group: 'action' })
    }
  }
  for (const cell of chips.facets ?? []) {
    facts.push({
      key: `facet-${cell.label}`,
      label: cell.label,
      value: cell.value,
      group: 'action',
    })
  }
  const tags: TagItem[] = (chips.traits ?? []).map((cell) => ({
    key: `trait-${cell.label}`,
    name: cell.label,
    ...(cell.value !== undefined ? { param: cell.value } : {}),
  }))
  return {
    set: { durations, facts, tags, ...(cost ? { cost } : {}) },
    ...(quantity ? { quantity } : {}),
  }
}
