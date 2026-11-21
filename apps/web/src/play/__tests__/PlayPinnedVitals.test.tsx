/**
 * The pinned vitals (play.md §11): what a spend reads above every pane on a
 * phone, five cells on one card. A live unit's cell opens that unit's rows
 * with their − | +, so damage lands without a switch of tab; a unit that may
 * not be written is a read-out.
 *
 * Uses toBeTruthy() not toBeInTheDocument() (jest-dom's matchers are not on
 * bun:test's expect).
 */

import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { PlayPinnedVitals } from '../PlayPinnedVitals'
import type { PinnedUnit } from '../playPanes.model'

const PINNED: PinnedUnit[] = [
  {
    kind: 'pilot',
    name: 'Bonesaw',
    vitals: [
      { label: 'HP', value: 7, max: 10 },
      { label: 'AP', value: 3, max: 5 },
    ],
  },
  {
    kind: 'mech',
    name: 'Buzzard',
    vitals: [
      { label: 'SP', value: 4, max: 10 },
      { label: 'EP', value: 4, max: 6 },
      { label: 'Heat', value: 3, max: 9 },
    ],
  },
]

const cell = (label: string) => screen.getByRole('button', { name: new RegExp(` ${label} \\d`) })

describe('the pinned vitals', () => {
  test('five cells on one card, closed until one is pressed', () => {
    render(
      <PlayPinnedVitals units={PINNED} live={{ pilot: true, mech: true }} onWrite={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'Bonesaw HP 7 of 10. Change' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Buzzard Heat 3 of 9. Change' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Decrease/ })).toBeNull()
  })

  test("a live unit's cell opens its rows, and a step writes the unit's field", () => {
    const onWrite = mock((_kind: string, _field: string, _next: number, _label: string) => {})
    render(<PlayPinnedVitals units={PINNED} live={{ pilot: true, mech: true }} onWrite={onWrite} />)
    fireEvent.click(cell('HP'))
    expect(cell('HP').getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Bonesaw Hit Points' }))
    expect(onWrite).toHaveBeenLastCalledWith('pilot', 'currentHP', 6, 'HP')
    fireEvent.click(cell('Heat'))
    fireEvent.click(screen.getByRole('button', { name: 'Increase Buzzard Heat' }))
    expect(onWrite).toHaveBeenLastCalledWith('mech', 'currentHeat', 4, 'Heat')
  })

  test('a second press closes the rows', () => {
    render(
      <PlayPinnedVitals units={PINNED} live={{ pilot: true, mech: true }} onWrite={() => {}} />
    )
    fireEvent.click(cell('SP'))
    fireEvent.click(cell('SP'))
    expect(screen.queryByRole('button', { name: /^Decrease/ })).toBeNull()
  })

  test('a unit that may not be written is a read-out', () => {
    render(
      <PlayPinnedVitals units={PINNED} live={{ pilot: false, mech: true }} onWrite={() => {}} />
    )
    expect(cell('HP').hasAttribute('disabled')).toBe(true)
    expect(cell('SP').hasAttribute('disabled')).toBe(false)
  })

  test("an open row's number asks for an amount and takes it in one write (LG-13)", () => {
    const onWrite = mock((_kind: string, _field: string, _next: number, _label: string) => {})
    render(<PlayPinnedVitals units={PINNED} live={{ pilot: true, mech: true }} onWrite={onWrite} />)
    fireEvent.click(cell('HP'))
    fireEvent.click(
      screen.getByRole('button', { name: 'Change Bonesaw Hit Points by an amount, now 7 of 10' })
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'HP amount' }), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Take 3 from HP' }))
    expect(onWrite).toHaveBeenCalledTimes(1)
    expect(onWrite).toHaveBeenLastCalledWith('pilot', 'currentHP', 4, 'HP', undefined)
    // The form is gone, the rows are back.
    expect(screen.queryByRole('textbox', { name: 'HP amount' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Decrease Bonesaw Hit Points' })).toBeTruthy()
  })
})
