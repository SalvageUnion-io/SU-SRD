/**
 * SearchListbox — the one list a search's results hang in: Tokens or Rows by
 * `form`, a category line that links or acts by `target`, and the searcher's
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
      form="row"
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

  test('form picks the entity form: a Row or a Token', () => {
    const { container, unmount } = list({ form: 'row' })
    expect(container.querySelector('.su-entity-row')).not.toBeNull()
    unmount()
    const tokens = list({ form: 'token' })
    expect(tokens.container.querySelector('.su-entity-token-list')).not.toBeNull()
    expect(tokens.container.querySelector('.su-entity-row')).toBeNull()
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
})
