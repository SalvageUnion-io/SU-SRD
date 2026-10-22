/**
 * Segmented — one named group of pressed-state options: the legend names the
 * group, `aria-pressed` says which option is on, and the ground and size reach
 * the stylesheet as data attributes.
 */
import { describe, expect, it } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { Segmented, SegmentedOption } from '../Segmented'

describe('Segmented', () => {
  it('names the group and says which option is pressed', () => {
    const picks: string[] = []
    render(
      <Segmented label="Showing">
        <SegmentedOption pressed onClick={() => picks.push('all')}>
          Everything
        </SegmentedOption>
        <SegmentedOption pressed={false} onClick={() => picks.push('free')}>
          Unassigned
        </SegmentedOption>
      </Segmented>
    )
    const group = screen.getByRole('group', { name: 'Showing' })
    // The ground is the frame's, never the control's (chrome K1).
    expect(group.hasAttribute('data-ground')).toBe(false)
    expect(group.getAttribute('data-size')).toBe('full')
    expect(screen.getByRole('button', { name: 'Everything' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }))
    expect(picks).toEqual(['free'])
  })

  it('carries the Compact Size, the fill and a numeral', () => {
    render(
      <Segmented label="Tech Level" size="compact" fill className="extra">
        <SegmentedOption pressed={false} numeral>
          1
        </SegmentedOption>
      </Segmented>
    )
    const group = screen.getByRole('group', { name: 'Tech Level' })
    expect(group.className).toBe('su-seg extra')
    expect(group.getAttribute('data-size')).toBe('compact')
    expect(group.hasAttribute('data-fill')).toBe(true)
    expect(screen.getByRole('button', { name: '1' }).hasAttribute('data-numeral')).toBe(true)
  })
})
