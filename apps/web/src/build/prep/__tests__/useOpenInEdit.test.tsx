import { expect, test } from 'bun:test'
import { renderHook } from '@testing-library/react'
import { useSheetModeStore } from '../../sheet/sheetMode.model'
import { editSearch, inEdit, useOpenInEdit } from '../useOpenInEdit'

/** Opened from a Game's Prep, a sheet opens in Edit (r7 C13, MD7-19). */

test('Prep links a sheet in Edit, and the route reads it back', () => {
  expect(inEdit('/encounters/e1')).toBe('/encounters/e1?edit=1')
  expect(editSearch({ edit: 1 })).toEqual({ edit: true })
  expect(editSearch({ edit: '1' })).toEqual({ edit: true })
  expect(editSearch({})).toEqual({})
})

test('a sheet opened that way turns Edit on; one opened plainly keeps the tab last used', () => {
  useSheetModeStore.getState().setEditing(false)
  renderHook(() => useOpenInEdit(undefined))
  expect(useSheetModeStore.getState().editing).toBe(false)
  renderHook(() => useOpenInEdit(true))
  expect(useSheetModeStore.getState().editing).toBe(true)
  useSheetModeStore.getState().setEditing(false)
})
