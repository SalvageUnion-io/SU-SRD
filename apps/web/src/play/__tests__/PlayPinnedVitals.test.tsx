/**
 * The pinned vitals (play.md §11): what a spend reads above every pane on a
 * phone, with its − / + while the unit is live, so damage lands without a
 * switch to the Units tab; a unit that may not be written is a read-out.
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

describe('the pinned vitals', () => {
  test('a live unit steps in place: − on HP writes HP − 1, + on Heat writes Heat + 1', () => {
    const onWrite = mock((_kind: string, _field: string, _next: number) => {})
    render(<PlayPinnedVitals units={PINNED} live={{ pilot: true, mech: true }} onWrite={onWrite} />)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease HP' }))
    expect(onWrite).toHaveBeenLastCalledWith('pilot', 'currentHP', 6)
    fireEvent.click(screen.getByRole('button', { name: 'Increase Heat' }))
    expect(onWrite).toHaveBeenLastCalledWith('mech', 'currentHeat', 4)
  })

  test('a unit that may not be written is a read-out', () => {
    render(
      <PlayPinnedVitals units={PINNED} live={{ pilot: false, mech: true }} onWrite={() => {}} />
    )
    expect(screen.queryByRole('button', { name: 'Decrease HP' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Decrease SP' })).toBeTruthy()
  })
})
