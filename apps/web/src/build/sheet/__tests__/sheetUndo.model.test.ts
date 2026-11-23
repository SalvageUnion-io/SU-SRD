/**
 * The sheet's Undo stays in its own tab, and Redo puts back what it undid
 * (r5 C2): Ctrl+Z reaches only the changes this tab made.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { mechFixture } from '../../../components/__tests__/fixtures'
import { resetStores } from '../../../replica/__tests__/resetStores'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import { LIVE_SHEET_MANUAL, PLAY_TXN } from '../../../replica/provenance'
import { useUnits } from '../../../replica/units'
import type { LogChange } from '../changeLog.model'
import { lastUndoableHere, sheetKey } from '../sheetUndo.model'

withSignedInBackend()

beforeEach(() => {
  resetStores()
})

const key = (over: Partial<KeyboardEvent>) =>
  sheetKey({ key: 'z', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over })

describe('sheetKey', () => {
  test('Ctrl+Z undoes; Ctrl+Shift+Z and Ctrl+Y redo', () => {
    expect(key({ ctrlKey: true })).toBe('undo')
    expect(key({ metaKey: true })).toBe('undo')
    expect(key({ ctrlKey: true, shiftKey: true, key: 'Z' })).toBe('redo')
    expect(key({ ctrlKey: true, key: 'y' })).toBe('redo')
    expect(key({ key: 'z' })).toBeNull()
    expect(key({ ctrlKey: true, altKey: true })).toBeNull()
    expect(key({ ctrlKey: true, key: 'x' })).toBeNull()
  })
})

const change = (id: string): LogChange => ({
  id,
  ts: 1,
  kind: 'manual',
  state: 'applied',
  lines: [],
  fields: [{ field: 'currentSP', before: 5, after: 4 }],
})

describe('lastUndoableHere', () => {
  test("takes back the newest change this tab made, never another tab's", async () => {
    const units = useUnits.getState()
    await units.adopt('mech', mechFixture({ id: 'm1', currentSP: 5 }))
    // This tab's own write makes an op whose id the log names its change by.
    const ids: string[] = []
    const send = globalThis.crypto.randomUUID.bind(globalThis.crypto)
    const spy = () => {
      const made = send()
      ids.push(made)
      return made
    }
    globalThis.crypto.randomUUID = spy as typeof globalThis.crypto.randomUUID
    try {
      await units.update('mech', 'm1', { currentSP: 4 }, LIVE_SHEET_MANUAL).catch(() => {})
    } finally {
      globalThis.crypto.randomUUID = send as typeof globalThis.crypto.randomUUID
    }
    const mine = ids.find((each) => lastUndoableHere([change(each)]) !== undefined)
    expect(mine).toBeDefined()
    // Another tab's change is newer in the log, yet Ctrl+Z here passes it by.
    const theirs = change('from-another-tab')
    expect(lastUndoableHere([theirs, change(mine ?? '')])?.id).toBe(mine)
    expect(lastUndoableHere([theirs])).toBeUndefined()
    // One already taken back here is passed by too.
    expect(lastUndoableHere([change(mine ?? '')], new Set([mine ?? '']))).toBeUndefined()
  })
})

describe('Redo in the ⋯ menu (r7 G8)', () => {
  test('what was undone is offered by name until the sheet’s next change', async () => {
    const { act, renderHook } = await import('@testing-library/react')
    const { useSheetUndo } = await import('../sheetUndo.model')
    const units = useUnits.getState()
    await units.adopt('mech', mechFixture({ id: 'm-redo', systems: ['armour-plating'] }))
    const { result } = renderHook(() =>
      useSheetUndo({
        kind: 'mech',
        id: 'm-redo',
        gameId: null,
        storeState: useUnits.getState(),
        defaults: {},
        blocked: false,
      })
    )
    expect(result.current.redoNext).toBeNull()
    const added: LogChange = {
      ...change('c-add'),
      fields: [{ field: 'systems', before: [], after: ['armour-plating'] }],
    }
    await act(async () => {
      await result.current.reverse(added, { done: 'Removed Armour Plating.' } as never)
    })
    expect(result.current.redoNext?.what).toBe('add Armour Plating')
    // Another change to the sheet ends it.
    await act(async () => {
      await useUnits
        .getState()
        .update('mech', 'm-redo', { currentSP: 3 }, LIVE_SHEET_MANUAL)
        .catch(() => {})
    })
    expect(result.current.redoNext).toBeNull()
  })
})

describe('Undo of a craft (r7 D6)', () => {
  test("the mech sheet's Undo gives the Scrap the craft spent back too", async () => {
    const { act, renderHook } = await import('@testing-library/react')
    const { useSheetUndo } = await import('../sheetUndo.model')
    const { crawlerFixture } = await import('../../../components/__tests__/fixtures')
    const units = useUnits.getState()
    await units.adopt('mech', mechFixture({ id: 'm-craft', systems: [] }))
    await units.adopt('crawler', crawlerFixture({ id: 'c-craft', scrapPool: { tl1: 3 } }))
    // The craft: the Scrap and the system in one transfer, as Downtime writes it.
    const ids: string[] = []
    const send = globalThis.crypto.randomUUID.bind(globalThis.crypto)
    globalThis.crypto.randomUUID = (() => {
      const made = send()
      ids.push(made)
      return made
    }) as typeof globalThis.crypto.randomUUID
    try {
      await units.transfer(
        {
          updates: [
            { type: 'crawler', id: 'c-craft', patch: { scrapPool: { tl1: 1 } } },
            { type: 'mech', id: 'm-craft', patch: { systems: ['armour-plating'] } },
          ],
        },
        PLAY_TXN
      )
    } finally {
      globalThis.crypto.randomUUID = send as typeof globalThis.crypto.randomUUID
    }
    expect(useUnits.getState().get('crawler', 'c-craft')?.scrapPool).toEqual({ tl1: 1 })
    const { result } = renderHook(() =>
      useSheetUndo({
        kind: 'mech',
        id: 'm-craft',
        gameId: null,
        storeState: useUnits.getState(),
        defaults: {},
        blocked: false,
      })
    )
    // The mech's half as its log reads it: the op the mech's write made.
    const made = ids.filter((each) => lastUndoableHere([change(each)]) !== undefined)
    const crafted = (id: string): LogChange => ({
      ...change(id),
      kind: 'transaction',
      fields: [{ field: 'systems', before: [], after: ['armour-plating'] }],
    })
    // The mech's op is the second the transfer made (after the crawler's).
    await act(async () => {
      await result.current.reverse(crafted(made[1] ?? ''), { done: 'Removed.' } as never)
    })
    expect(useUnits.getState().get('mech', 'm-craft')?.systems).toEqual([])
    expect(useUnits.getState().get('crawler', 'c-craft')?.scrapPool).toEqual({ tl1: 3 })
    // Redo puts both halves back.
    await act(async () => {
      result.current.redoLast()
    })
    await new Promise((settle) => setTimeout(settle, 0))
    expect(useUnits.getState().get('mech', 'm-craft')?.systems).toEqual(['armour-plating'])
    expect(useUnits.getState().get('crawler', 'c-craft')?.scrapPool).toEqual({ tl1: 1 })
  })
})
