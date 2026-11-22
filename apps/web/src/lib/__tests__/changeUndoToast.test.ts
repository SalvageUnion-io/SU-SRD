/**
 * changeUndoToast: one line a number, and each change its own Undo (r3 B2).
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { toast } from 'sonner'
import { changeUndoToast } from '../changeUndoToast'

const open = (id: string) =>
  toast.getToasts().filter((t) => t.id === id && !('dismiss' in t && t.dismiss))

afterEach(() => toast.dismiss())

describe('one line a number', () => {
  test('a change puts its line up', () => {
    changeUndoToast({ id: 'n:a', label: 'EP', from: 10, to: 8, undo: () => {} })
    expect(open('n:a')).toHaveLength(1)
  })

  test('a second change replaces the line, and Undo takes back that change alone (r3 B2)', () => {
    const undone: number[] = []
    const undo = (value: number) => undone.push(value)
    // A 3-point hit, then a mistyped 12 that empties the pool.
    changeUndoToast({ id: 'n:b', label: 'SP', from: 9, to: 6, undo })
    changeUndoToast({ id: 'n:b', label: 'SP', from: 6, to: 0, undo })
    const lines = open('n:b')
    expect(lines).toHaveLength(1)
    const action = (lines[0] as { action?: { onClick: (e: never) => void } }).action
    action?.onClick(undefined as never)
    // Back to 6, where the hit left it: never to 9.
    expect(undone).toEqual([6])
  })

  test('a change that moves nothing shows no line', () => {
    changeUndoToast({ id: 'n:c', label: 'EP', from: 8, to: 8, undo: () => {} })
    expect(open('n:c')).toHaveLength(0)
  })
})
