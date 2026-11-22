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

  test("each quick removal keeps its own Undo, through the sheet's later writes, the newest three (r4 E3, r5 C3)", async () => {
    const undone: string[] = []
    for (const name of ['a', 'b', 'c']) {
      undoToast(`Removed ${name}`, () => undone.push(name), 'm1', { stack: true })
    }
    await units.update('mech', 'm1', {}, LIVE_SHEET_MANUAL).catch(() => {})
    const lines = () =>
      toast
        .getToasts()
        .filter((t) => !('dismiss' in t && t.dismiss) && String(t.id).startsWith('undo:m1:'))
    expect(lines()).toHaveLength(3)
    // The FIRST removal's Undo is still there, and runs its own way back.
    const first = lines().find(
      (t) => (t as { title?: unknown }).title === 'Removed a'
    ) as unknown as {
      action: { onClick: (e: unknown) => void }
    }
    first.action.onClick({})
    expect(undone).toEqual(['a'])
    for (const name of ['d', 'e', 'f', 'g']) {
      undoToast(`Removed ${name}`, () => {}, 'm1', { stack: true })
    }
    expect(lines()).toHaveLength(3)
    // The newest stay; the oldest left.
    expect(lines().map((t) => (t as { title?: unknown }).title)).toEqual([
      'Removed e',
      'Removed f',
      'Removed g',
    ])
    leaveSheet('m1')
    expect(lines()).toHaveLength(0)
  })
})
