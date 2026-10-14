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
          Not in a Game
        </SegmentedOption>
      </Segmented>
    )
    const group = screen.getByRole('group', { name: 'Showing' })
    expect(group.getAttribute('data-ground')).toBe('paper')
    expect(group.getAttribute('data-size')).toBe('rail')
    expect(screen.getByRole('button', { name: 'Everything' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Not in a Game' }))
    expect(picks).toEqual(['free'])
  })

  it('carries the ink ground, the page size, the fill and a numeral', () => {
    render(
      <Segmented label="Tech Level" ground="ink" size="page" fill className="extra">
        <SegmentedOption pressed={false} numeral>
          1
        </SegmentedOption>
      </Segmented>
    )
    const group = screen.getByRole('group', { name: 'Tech Level' })
    expect(group.className).toBe('su-seg extra')
    expect(group.getAttribute('data-ground')).toBe('ink')
    expect(group.getAttribute('data-size')).toBe('page')
    expect(group.hasAttribute('data-fill')).toBe(true)
    expect(screen.getByRole('button', { name: '1' }).hasAttribute('data-numeral')).toBe(true)
  })
})
