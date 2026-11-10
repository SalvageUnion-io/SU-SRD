/**
 * SearchListbox — the one list a search's results hang in: Minis or Compacts by
 * `size`, a category line that links or acts by `target`, and the searcher's
 * empty line (chrome K8).
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { unitRowModel } from '../../../lib/units/unitModel'
import { SearchListbox } from '../SearchListbox'
import { NO_RESULTS } from '../searchCopy'
import type { SearchComboboxResult } from '../useSearchCombobox'

const MULE = {
  kind: 'entity',
  id: 'mule',
  title: 'Mule',
  group: 'Chassis',
  schemaId: 'chassis',
  entity: { id: 'mule', name: 'Mule' },
} as unknown as SearchComboboxResult

const CHASSIS: SearchComboboxResult = {
  kind: 'schema',
  id: 'schema:chassis',
  title: 'Chassis',
  group: 'Category',
  schemaId: 'chassis',
}

const model = unitRowModel({ kind: 'mech', name: 'Mule' })

function list(props: Partial<Parameters<typeof SearchListbox>[0]> = {}) {
  return render(
    <SearchListbox
      id="results"
      size="compact"
      ready
      results={[MULE, CHASSIS]}
      selectedIndex={1}
      optionId={(i) => `opt-${i}`}
      modelOf={(r) => (r.kind === 'entity' ? model : undefined)}
      target={{ href: (r) => `/${r.id}` }}
      {...props}
    />
  )
}

describe('SearchListbox', () => {
  test('every result is an option; the highlighted one is selected', () => {
    list()
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.id)).toEqual(['opt-0', 'opt-1'])
    expect(options[1]?.getAttribute('aria-selected')).toBe('true')
  })

  test('size picks the entity form: a Compact or a Mini', () => {
    const { container, unmount } = list({ size: 'compact' })
    expect(container.querySelector('.su-entity-compact')).not.toBeNull()
    unmount()
    const tokens = list({ size: 'mini' })
    expect(tokens.container.querySelector('.su-entity-mini-list')).not.toBeNull()
    expect(tokens.container.querySelector('.su-entity-compact')).toBeNull()
  })

  test('a link target makes the category a link; an act target, an act', () => {
    const { unmount } = list()
    expect(screen.getByRole('option', { name: /Chassis/ }).getAttribute('href')).toBe(
      '/schema:chassis'
    )
    unmount()
    const opened: string[] = []
    list({ target: { open: (r) => opened.push(r.id) } })
    const category = screen.getByRole('option', { name: /Chassis/ })
    expect(category.getAttribute('href')).toBeNull()
    fireEvent.click(category)
    expect(opened).toEqual(['schema:chassis'])
  })

  test('nothing matched says so in the searcher’s words', () => {
    list({ results: [] })
    expect(screen.getByText(NO_RESULTS)).toBeTruthy()
  })

  test('kinds: a Mini result says what kind of thing it is, a stamp beside its name', () => {
    list({ size: 'mini', kinds: true })
    const mule = screen.getAllByRole('option')[0]
    expect(mule?.textContent).toContain('Chassis')
  })

  test('the row for what a full list left out is an option like any other', () => {
    const more: SearchComboboxResult = {
      kind: 'more',
      id: 'more:chassis',
      title: '12 more Chassis',
      group: 'Open the filtered list',
      schemaId: 'chassis',
      query: 'mu',
    }
    list({ results: [MULE, more] })
    expect(screen.getAllByRole('option')[1]?.textContent).toContain('12 more Chassis')
  })
})
