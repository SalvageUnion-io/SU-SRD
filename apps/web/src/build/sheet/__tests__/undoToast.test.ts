/**
 * The Undo for something taken off a sheet waits for the player (r2 C1): it
 * stands until answered, dismissed, or the sheet's next write.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { toast } from '../../../components/index'
import { changeUndoToast } from '../../../lib/changeUndoToast'
import { LIVE_SHEET_MANUAL } from '../../../replica/provenance'
import { units } from '../../../replica/units'
import { ruleBreakToast } from '../ruleBreakToast.model'
import { leaveSheet, undoToast } from '../undoToast.model'

const shown = () => toast.getToasts().map((t) => t.id)

beforeEach(() => {
  toast.dismiss()
})

afterEach(() => {
  toast.dismiss()
})

describe('undoToast', () => {
  test('stands with no timer, one line a sheet', () => {
    undoToast('Removed Red Laser', () => {}, 'm1')
    undoToast('Chassis changed to Mazona', () => {}, 'm1')
    const lines = toast.getToasts().filter((t) => t.id === 'undo:m1')
    expect(lines).toHaveLength(1)
    expect((lines[0] as { duration?: number }).duration).toBe(Number.POSITIVE_INFINITY)
  })

  test("leaves on that sheet's next write, and on no other sheet's", async () => {
    undoToast('Removed Red Laser', () => {}, 'm1')
    await units.update('mech', 'm2', {}, LIVE_SHEET_MANUAL).catch(() => {})
    expect(shown()).toContain('undo:m1')
    await units.update('mech', 'm1', {}, LIVE_SHEET_MANUAL).catch(() => {})
    expect(shown()).not.toContain('undo:m1')
  })

  test('Undo runs the way back once', () => {
    let undone = 0
    undoToast('Removed Red Laser', () => undone++, 'm1')
    const line = toast.getToasts().find((t) => t.id === 'undo:m1') as unknown as {
      action: { onClick: (e: unknown) => void }
    }
    line.action.onClick({})
    expect(undone).toBe(1)
  })

  test("leaving a sheet takes its Undo, its number lines and its rule-break lines, and no other sheet's (r3 B3)", () => {
    undoToast('Removed Cargo Pod', () => {}, 'm1')
    undoToast('Removed Red Laser', () => {}, 'm2')
    ruleBreakToast('m1', [{ stat: 'systemSlots', used: 13, max: 12 }])
    ruleBreakToast('m2', [{ stat: 'systemSlots', used: 13, max: 12 }])
    changeUndoToast({ id: 'mech:m1:currentEP', label: 'EP', from: 10, to: 8, undo: () => {} })
    changeUndoToast({ id: 'mech:m2:currentEP', label: 'EP', from: 10, to: 8, undo: () => {} })

    leaveSheet('m1')

    const open = toast
      .getToasts()
      .filter((t) => !('dismiss' in t && t.dismiss))
      .map((t) => t.id)
    expect(open.sort()).toEqual(['mech:m2:currentEP', 'rule-break:m2:systemSlots', 'undo:m2'])
  })
})
