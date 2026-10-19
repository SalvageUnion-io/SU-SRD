/**
 * The phone's search: a magnifier in the bar that opens a sheet hosting the
 * SRD search, which mounts only while the sheet is open.
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MobileSearchIsland } from '../MobileSearchIsland'

describe('MobileSearchIsland', () => {
  test('the trigger opens a Search sheet with the combobox; Close search shuts it', async () => {
    render(<MobileSearchIsland />)
    expect(screen.queryByRole('combobox')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Search the Reference' }))
    })
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByText('Search')).toBeTruthy()
    expect(within(sheet).getByRole('combobox', { name: 'Search the Reference' })).toBeTruthy()

    await act(async () => {
      fireEvent.click(within(sheet).getByRole('button', { name: 'Close search' }))
    })
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
