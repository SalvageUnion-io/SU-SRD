/**
 * The Undo for something taken off a sheet stays as any toast with an action
 * does (chrome K5: 20 seconds; r5 C3, over r2 C1's standing line), and leaves
 * sooner when answered, dismissed, or on the sheet's next write.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { ACTION_TOAST_MS, toast } from '../../../components/index'
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
  test('stays 20 seconds with a close of its own, one line a sheet (r5 C3)', () => {
    undoToast('Removed Red Laser', () => {}, 'm1')
    undoToast('Chassis changed to Mazona', () => {}, 'm1')
    const lines = toast.getToasts().filter((t) => t.id === 'undo:m1')
    expect(lines).toHaveLength(1)
    expect((lines[0] as { duration?: number }).duration).toBe(ACTION_TOAST_MS)
    expect((lines[0] as { closeButton?: boolean }).closeButton).toBe(true)
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
    const open = () =>
      toast
        .getToasts()
        .filter((t) => !('dismiss' in t && t.dismiss))
        .map((t) => t.id)
    const lines: [string, () => void][] = [
      ['undo:m1', () => undoToast('Removed Cargo Pod', () => {}, 'm1')],
      [
        'rule-break:m1:systemSlots',
        () => ruleBreakToast('m1', [{ stat: 'systemSlots', used: 13, max: 12 }]),
      ],
      [
        'mech:m1:currentEP',
        () =>
          changeUndoToast({
            id: 'mech:m1:currentEP',
            label: 'EP',
            from: 10,
            to: 8,
            undo: () => {},
          }),
      ],
    ]
    for (const [id, show] of lines) {
      show()
      // One stands at a time (r7 A4): another sheet's leaving leaves it.
      leaveSheet('m2')
      expect(open()).toEqual([id])
      leaveSheet('m1')
      expect(open()).toEqual([])
    }
  })

  test("a quick removal's Undo runs through the sheet's later writes; a newer one replaces it (r4 E3, r7 A4)", async () => {
    const undone: string[] = []
    for (const name of ['a', 'b']) {
      undoToast(`Removed ${name}`, () => undone.push(name), 'm1', { stack: true })
    }
    await units.update('mech', 'm1', {}, LIVE_SHEET_MANUAL).catch(() => {})
    const lines = () =>
      toast
        .getToasts()
        .filter((t) => !('dismiss' in t && t.dismiss) && String(t.id).startsWith('undo:m1:'))
    // The newest stands alone; Ctrl+Z and the Change Log reach the older.
    expect(lines().map((t) => (t as { title?: unknown }).title)).toEqual(['Removed b'])
    const newest = lines()[0] as unknown as { action: { onClick: (e: unknown) => void } }
    newest.action.onClick({})
    expect(undone).toEqual(['b'])
    undoToast('Removed c', () => {}, 'm1', { stack: true })
    leaveSheet('m1')
    expect(lines()).toHaveLength(0)
  })
})
