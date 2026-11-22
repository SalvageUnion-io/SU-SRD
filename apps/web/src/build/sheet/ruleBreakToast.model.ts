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
import { componentsCopy } from '../../messages/components'

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

const toastId = (unitId: string, stat: RuleBreakStat) => `rule-break:${unitId}:${stat}`

/** Say each break an edit made, on the document's one toaster. */
export function ruleBreakToast(unitId: string, made: readonly RuleBreak[]) {
  for (const one of made) toast.warning(ruleBreakLine(one), { id: toastId(unitId, one.stat) })
}

const buildToastId = (unitId: string) => `rule-break:${unitId}:build`

/**
 * A build edit that saved against the book's advice (an ability out of its
 * tree's order, one added with too few Training Points): one line says what
 * it breaks, and Undo takes the edit back (r3 B5). It stands until answered,
 * as a removal's Undo does, and leaves with its sheet.
 */
export function buildBreakToast(unitId: string, broken: readonly string[], undo: () => void) {
  toast.warning(buildSheetCopy('savedBreaking', { rules: broken.join(' ') }), {
    id: buildToastId(unitId),
    duration: Number.POSITIVE_INFINITY,
    closeButton: true,
    action: { label: componentsCopy('undo'), onClick: undo },
  })
}

/** Take down a unit's rule-break lines: its sheet is no longer on screen (r3 B3). */
export function dismissRuleBreaks(unitId: string) {
  for (const stat of Object.keys(STAT_NAME) as RuleBreakStat[]) toast.dismiss(toastId(unitId, stat))
  toast.dismiss(buildToastId(unitId))
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
