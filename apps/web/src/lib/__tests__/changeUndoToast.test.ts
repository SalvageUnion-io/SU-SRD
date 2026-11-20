/**
 * changeUndoToast: presses on one number while its line is up are one change,
 * and a run that ends where it started takes its line down.
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

  test('a run back to where it started takes the line down', () => {
    changeUndoToast({ id: 'n:b', label: 'EP', from: 10, to: 8, undo: () => {} })
    changeUndoToast({ id: 'n:b', label: 'EP', from: 8, to: 10, undo: () => {} })
    expect(open('n:b')).toHaveLength(0)
  })
})
