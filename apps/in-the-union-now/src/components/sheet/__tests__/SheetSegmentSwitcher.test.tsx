/**
 * SheetSegmentSwitcher tests (#255).
 *
 * The switcher is the mobile-only Pilot | Mech | Crawler control. happy-dom
 * does not compute layout, so we assert on rendered roles/labels and click
 * behaviour rather than on visual placement.
 *
 * Conventions:
 *  - toBeTruthy() not toBeInTheDocument()
 *  - No mock.module()
 *  - afterEach cleanup()
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'

import { SheetSegmentSwitcher } from '../SheetSegmentSwitcher'
import type { SheetSegment } from '../SheetSegmentSwitcher'

afterEach(() => {
  cleanup()
})

describe('SheetSegmentSwitcher', () => {
  test('renders only the segments it is given', () => {
    render(<SheetSegmentSwitcher segments={['pilot', 'mech']} active="pilot" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Pilot' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Mech' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Crawler' })).toBeNull()
  })

  test('marks the active segment with aria-selected', () => {
    render(
      <SheetSegmentSwitcher
        segments={['pilot', 'mech', 'crawler']}
        active="mech"
        onChange={() => {}}
      />
    )
    expect(screen.getByRole('tab', { name: 'Mech' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Pilot' }).getAttribute('aria-selected')).toBe('false')
  })

  test('fires onChange with the tapped segment', () => {
    const onChange = mock((segment: SheetSegment) => segment)
    render(
      <SheetSegmentSwitcher segments={['pilot', 'crawler']} active="pilot" onChange={onChange} />
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Crawler' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]?.[0]).toBe('crawler')
  })
})
