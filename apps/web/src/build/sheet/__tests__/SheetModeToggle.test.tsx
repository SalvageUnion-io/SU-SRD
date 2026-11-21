/**
 * One page per unit (ADR-066, hard rule R11): the sheet's modes are one
 * Segmented, Read | Edit | Play. Play is a third option of the same control,
 * never a second button or page; a viewer who may not write sees Play alone.
 */

import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SheetModeToggle } from '../SheetModeToggle'

const mode = (editing: boolean) => ({ editing, setEditing: mock((_: boolean) => undefined) })

describe('Read | Edit | Play', () => {
  test('one control holds all three, the mode you are in pressed', () => {
    const onPlay = mock(() => undefined)
    render(<SheetModeToggle mode={mode(false)} kind="pilot" play={{ name: 'Rook', onPlay }} />)
    const group = screen.getByRole('group', { name: /pilot/i })
    const options = within(group).getAllByRole('button')
    expect(options.map((o) => o.textContent)).toEqual(['Sheet', 'Edit', 'Play'])
    expect(options.map((o) => o.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    fireEvent.click(within(group).getByRole('button', { name: 'Play as Rook' }))
    expect(onPlay).toHaveBeenCalledTimes(1)
  })

  test('with nothing to play, Read | Edit alone; with no writes, Play alone', () => {
    const { unmount } = render(<SheetModeToggle mode={mode(true)} kind="mech" />)
    expect(screen.getAllByRole('button').map((o) => o.textContent)).toEqual(['Sheet', 'Edit'])
    unmount()
    render(<SheetModeToggle mode={null} kind="pilot" play={{ name: 'Rook', onPlay: () => {} }} />)
    expect(screen.getAllByRole('button').map((o) => o.textContent)).toEqual(['Play'])
  })
})
