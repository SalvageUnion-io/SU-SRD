/**
 * The picker's keyboard and its search (r4 E4, E5, E6): Down and Up move one
 * highlight through the rows and Enter adds that row; what the search names
 * in a switched-off Tech Level is listed, and Enter takes it before a row
 * matched only on its rules text; Filters counts only its own panel.
 */

import { describe, expect, it, mock } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { nameToSlug } from 'salvageunion-reference'
import { EntitySearcher } from '../EntitySearcher'
import { namedBy } from '../searcherFacts'
import { POOL_RENDER_MS, setViewport } from './entitySearcherHarness'

const slug = (item: { name: string }) => nameToSlug(item.name)

const cursors = () => [...document.querySelectorAll('[data-cursor]')]

describe('EntitySearcher: arrows, names and filters', () => {
  it(
    'Down and Up move one highlight, and Enter adds the highlighted row',
    () => {
      const onAdd = mock((_: string) => undefined)
      render(
        <EntitySearcher schema="systems" mode="count" selected={[]} idOf={slug} onAdd={onAdd} />
      )
      const search = screen.getByRole('textbox', { name: 'Search' })
      fireEvent.change(search, { target: { value: 'ballistic' } })
      const rows = [...document.querySelectorAll('.su-searcher__item')]
      expect(rows.length).toBeGreaterThan(3)
      expect(cursors()).toHaveLength(0)
      fireEvent.keyDown(search, { key: 'ArrowDown' })
      fireEvent.keyDown(search, { key: 'ArrowDown' })
      fireEvent.keyDown(search, { key: 'ArrowDown' })
      fireEvent.keyDown(search, { key: 'ArrowDown' })
      fireEvent.keyDown(search, { key: 'ArrowUp' })
      // One row wears it, the third, and the field points at it.
      expect(cursors()).toEqual([rows[2] as Element])
      expect(search.getAttribute('aria-activedescendant')).toBe(rows[2]?.id ?? '')
      fireEvent.keyDown(search, { key: 'Enter' })
      expect(onAdd).toHaveBeenCalledTimes(1)
      const third = rows[2]?.querySelector('[data-searcher-open]') as HTMLElement
      expect(onAdd.mock.calls[0]?.[0]).toBe(third.dataset.searcherOpen ?? '')
      // The highlight clears with the add, and a second Enter waits for a row (r5 C5).
      expect(cursors()).toHaveLength(0)
      fireEvent.keyDown(search, { key: 'Enter' })
      expect(onAdd).toHaveBeenCalledTimes(1)
      fireEvent.keyDown(search, { key: 'ArrowDown' })
      fireEvent.keyDown(search, { key: 'Enter' })
      expect(onAdd).toHaveBeenCalledTimes(2)
      // A new search starts with no highlight, and Enter adds again.
      fireEvent.change(search, { target: { value: 'ballisti' } })
      expect(cursors()).toHaveLength(0)
      fireEvent.keyDown(search, { key: 'Enter' })
      expect(onAdd).toHaveBeenCalledTimes(3)
    },
    POOL_RENDER_MS
  )

  it(
    'lists what the search names in another Tech Level, and Enter adds it, never a rules-text match',
    () => {
      const onAdd = mock((_: string) => undefined)
      render(
        <EntitySearcher
          schema="modules"
          mode="count"
          selected={[]}
          idOf={slug}
          techLevel={1}
          onAdd={onAdd}
        />
      )
      const search = screen.getByRole('textbox', { name: 'Search' })
      fireEvent.change(search, { target: { value: 'targeting' } })
      const other = screen.getByRole('region', { name: 'In other Tech Levels' })
      expect(within(other).getByText('Targeting Reticule')).toBeTruthy()
      expect(screen.getByText(/named in other Tech Levels/)).toBeTruthy()
      fireEvent.keyDown(search, { key: 'Enter' })
      expect(onAdd.mock.calls.map((call) => call[0])).toEqual(['targeting-reticule'])
    },
    POOL_RENDER_MS
  )

  it(
    'Filters does not count the Tech level chips set beside it',
    () => {
      const initial = { width: window.innerWidth, height: window.innerHeight }
      setViewport(1280, 900)
      try {
        render(
          <EntitySearcher schema="systems" mode="count" selected={[]} idOf={slug} techLevel={3} />
        )
        const filters = screen.getByRole('button', { name: /^Filters/ })
        expect(filters.textContent).toBe('Filters')
        // A wide row says what it is worth and what it does.
        expect(document.querySelector('.su-searcher__facts')?.textContent).toContain('SV')
      } finally {
        setViewport(initial.width, initial.height)
      }
    },
    POOL_RENDER_MS
  )
})

describe('namedBy', () => {
  it('takes every typed word in the name, and nothing matched on its text alone', () => {
    expect(namedBy({ name: 'Targeting Reticule' }, 'targeting')).toBe(true)
    expect(namedBy({ name: 'Targeting Reticule' }, 'RETICULE target')).toBe(true)
    expect(namedBy({ name: 'Eggs Mayhem' }, 'targeting')).toBe(false)
    expect(namedBy({ name: 'Railgun' }, '  ')).toBe(false)
  })
})
