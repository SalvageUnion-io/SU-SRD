/**
 * `EntitySearcher`'s soft budgets: one label-first `Stat` chip per budget
 * (`INVENTORY SLOTS | 4/6`), its frame the status colour when over. Honest over
 * capacity, and never blocking a pick.
 */

import { Stat } from '../atoms/Stat'
import type { BudgetConfig } from './entitySearcherTypes'

export function BudgetChips({ budgets }: { budgets: BudgetConfig[] }) {
  return budgets.map((b) => (
    <Stat
      key={b.label}
      size="compact"
      label={b.label}
      value={b.used}
      max={b.max}
      state={b.used > b.max ? 'critical' : undefined}
    />
  ))
}
