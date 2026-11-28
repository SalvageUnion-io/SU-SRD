/**
 * One page per unit (ADR-066, hard rule R11): the sheet's modes are one
 * Segmented, Read | Edit and the door into Play, a third option of the same
 * control, never a second button or page; a viewer who may not write sees the
 * door alone. The door has its one name (glossary §9, r3 H3): Open table,
 * or Join session while the pilot's Game has a session live; a pilot in no
 * Game has no table to open, so its door reads Play solo (r4 C7).
 */

import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SheetModeToggle } from '../SheetModeToggle'

const mode = (editing: boolean) => ({ editing, setEditing: mock((_: boolean) => undefined) })

describe('Read | Edit | Play', () => {
  test('one control holds all three, the mode you are in pressed', () => {
    const onPlay = mock(() => undefined)
    render(
      <SheetModeToggle
        mode={mode(false)}
        kind="pilot"
        play={{ name: 'Rook', onPlay, gameId: 'g1' }}
      />
    )
    const group = screen.getByRole('group', { name: /pilot/i })
    const options = within(group).getAllByRole('button')
    expect(options.map((o) => o.textContent)).toEqual(['Sheet', 'Edit', 'Open table'])
    expect(options.map((o) => o.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    fireEvent.click(within(group).getByRole('button', { name: 'Open table as Rook' }))
    expect(onPlay).toHaveBeenCalledTimes(1)
  })

  test('with nothing to play, Read | Edit alone; with no writes, Play alone', () => {
    const { unmount } = render(<SheetModeToggle mode={mode(true)} kind="mech" />)
    expect(screen.getAllByRole('button').map((o) => o.textContent)).toEqual(['Sheet', 'Edit'])
    unmount()
    render(<SheetModeToggle mode={null} kind="pilot" play={{ name: 'Rook', onPlay: () => {} }} />)
    expect(screen.getAllByRole('button').map((o) => o.textContent)).toEqual(['Play solo'])
  })

  // SB4-08: "Open table" read as something for a shared table to a Pilot with none.
  test('a Pilot in no Game: the door says Play solo, and who plays', () => {
    const onPlay = mock(() => undefined)
    render(
      <SheetModeToggle
        mode={mode(false)}
        kind="pilot"
        play={{ name: 'Rook', onPlay, gameId: null }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Play solo as Rook' }))
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /Open table/ })).toBeNull()
  })
})
