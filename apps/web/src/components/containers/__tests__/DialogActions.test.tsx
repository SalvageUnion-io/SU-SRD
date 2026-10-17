/** DialogActions lays a dialog's buttons out right-aligned, wrapping, 8px apart. */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { DialogActions } from '../DialogActions'

describe('DialogActions', () => {
  test('holds its buttons in one right-aligned wrapping row', () => {
    render(
      <DialogActions>
        <button type="button">Cancel</button>
      </DialogActions>
    )
    const row = screen.getByRole('button', { name: 'Cancel' }).parentElement
    expect(row?.style.justifyContent).toBe('flex-end')
    expect(row?.style.flexWrap).toBe('wrap')
  })
})
