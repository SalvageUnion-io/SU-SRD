/**
 * The sheet reopens on the tab last used (SB-13): Edit survives a reload
 * through this browser's storage, and Sheet clears it.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { SHEET_MODE_KEY, storedEditing, useSheetModeStore } from '../sheetMode.model'

afterEach(() => {
  useSheetModeStore.getState().setEditing(false)
})

describe('the last tab is remembered', () => {
  test('Edit is stored and read back; Sheet clears it', () => {
    useSheetModeStore.getState().setEditing(true)
    expect(localStorage.getItem(SHEET_MODE_KEY)).toBe('edit')
    expect(storedEditing()).toBe(true)
    useSheetModeStore.getState().setEditing(false)
    expect(localStorage.getItem(SHEET_MODE_KEY)).toBeNull()
    expect(storedEditing()).toBe(false)
  })
})
