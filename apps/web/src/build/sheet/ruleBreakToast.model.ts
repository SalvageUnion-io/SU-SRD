/**
 * ruleBreakToast — a rule-breaking edit saves (Free Edit never blocks,
 * surfaces §1), and at that moment one line says what broke and by how much:
 * "Saved, rule breaking: System Slots 16/12, 4 over." A line a stat, so a run
 * of adds keeps one line with the latest count.
 */

import { toast } from '../../components/index'
import type { CargoTransferResult } from '../../lib/cargo/cargoTransfer'
import { carrierCargoUsage } from '../../lib/cargo/cargoTransfer'
import type { RuleBreak, RuleBreakStat } from '../../lib/rules/ruleBreaks'
import { cargoRuleBreaks, ruleBreaksMade } from '../../lib/rules/ruleBreaks'
import { buildSheetCopy } from '../../messages/build-sheet'

const STAT_NAME: Record<RuleBreakStat, () => string> = {
  systemSlots: () => buildSheetCopy('systemSlots'),
  moduleSlots: () => buildSheetCopy('moduleSlots'),
  cargoCapacity: () => buildSheetCopy('cargo'),
  inventorySlots: () => buildSheetCopy('inventorySlots'),
}

/** The line for one break. */
export function ruleBreakLine(made: RuleBreak): string {
  return buildSheetCopy('savedRuleBreaking', {
    stat: STAT_NAME[made.stat](),
    used: made.used,
    max: made.max,
    over: made.used - made.max,
  })
}

/** Say each break an edit made, on the document's one toaster. */
export function ruleBreakToast(unitId: string, made: readonly RuleBreak[]) {
  for (const one of made)
    toast.warning(ruleBreakLine(one), { id: `rule-break:${unitId}:${one.stat}` })
}

/**
 * A load into a hold that landed: said when it took Cargo over its capacity,
 * or further over, like any other rule break. A refused load says nothing here.
 */
export function cargoBreakToast(
  unitId: string,
  before: { used: number; cap: number },
  result: CargoTransferResult
) {
  if (!result.ok) return
  const after = carrierCargoUsage(result.state.carrierLots, result.state.carrierCargoCap)
  ruleBreakToast(unitId, ruleBreaksMade(cargoRuleBreaks(before), cargoRuleBreaks(after)))
}
