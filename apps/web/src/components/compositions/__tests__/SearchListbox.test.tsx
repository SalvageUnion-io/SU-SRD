/**
 * SearchListbox — the one list a search's results hang in: a Ledger or Compacts by
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

  test('size picks the entity form: a Compact each, or one Ledger', () => {
    const { container, unmount } = list({ size: 'compact' })
    expect(container.querySelector('.su-entity-compact')).not.toBeNull()
    expect(container.querySelector('.su-search-ledger')).toBeNull()
    unmount()
    const ledger = list({ size: 'mini' })
    expect(ledger.container.querySelectorAll('.su-search-ledger tbody tr')).toHaveLength(1)
  })

  test('a Ledger keeps the search’s order: a category first stays first', () => {
    list({ size: 'mini', results: [CHASSIS, MULE], selectedIndex: 0 })
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.id)).toEqual(['opt-0', 'opt-1'])
    expect(options[0]?.textContent).toContain('Category')
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

  test('a Ledger row says what kind of thing it is, in a column beside its name', () => {
    list({ size: 'mini' })
    const mule = screen.getAllByRole('option')[0]
    expect(mule?.closest('tr')?.textContent).toContain('Chassis')
  })

  test('two Compacts of one name say their kind; a name of its own does not (r5 E3)', () => {
    const heat = (id: string, group: string, stamp: string) => ({
      result: { ...MULE, id, title: 'Heat', group } as SearchComboboxResult,
      model: { ...model, title: 'Heat', kind: { ...model.kind, stamp } },
    })
    const rows = [heat('g', 'Guides', 'Guide'), heat('k', 'Keywords', 'Keyword')]
    list({
      results: [...rows.map((r) => r.result), MULE],
      modelOf: (r) => rows.find((row) => row.result.id === r.id)?.model ?? model,
    })
    // What the eye reads: the screen reader's own kind label left out.
    const seen = (option: HTMLElement | undefined) => {
      const row = option?.closest('.su-entity-compact')?.cloneNode(true)
      if (!(row instanceof HTMLElement)) return ''
      for (const sr of row.querySelectorAll('.su-sr-only')) sr.remove()
      return row.textContent ?? ''
    }
    const [guide, keyword, mule] = screen.getAllByRole('option')
    expect(seen(guide)).toContain('Guide')
    expect(seen(keyword)).toContain('Keyword')
    expect(seen(mule)).toBe('Mule')
  })

  test('a dropdown row answers in place: its range and damage, a term its meaning, a shared name its kind (RR6-04, RR6-15)', () => {
    const facts = [
      {
        key: 'range',
        label: 'Range',
        short: 'RNG',
        value: 'Long',
        shortValue: 'Long',
        kind: 'fact',
      },
      { key: 'damage', label: 'Damage', short: 'DMG', value: '9 SP', kind: 'fact' },
    ]
    const railgun = {
      result: { ...MULE, id: 'railgun', title: 'Railgun', group: 'Systems', schemaId: 'systems' },
      model: { ...model, title: 'Railgun', facts },
    }
    const heat = (id: string, schemaId: string, lead?: string) => ({
      result: { ...MULE, id, title: 'Heat', schemaId } as SearchComboboxResult,
      model: { ...model, title: 'Heat', ...(lead ? { lead } : {}) },
    })
    const rows = [
      railgun,
      heat('k', 'keywords', 'Generates on your Mech when you perform various tasks.'),
      heat('g', 'guides'),
    ]
    list({
      size: 'mini',
      results: rows.map((r) => r.result as SearchComboboxResult),
      selectedIndex: -1,
      modelOf: (r) => rows.find((row) => row.result.id === r.id)?.model as typeof model,
    })
    const [gun, keyword, guide] = screen.getAllByRole('option')
    expect(gun?.closest('tr')?.textContent).toContain('Long')
    expect(gun?.closest('tr')?.textContent).toContain('9 SP')
    expect(keyword?.textContent).toBe('Heat · Keyword')
    expect(guide?.textContent).toBe('Heat · Guide')
    expect(keyword?.closest('tr')?.textContent).toContain('Generates on your Mech')
  })

  test('"See all N results" is an option that links to the page of every result (r8 G2)', () => {
    const more: SearchComboboxResult = {
      kind: 'more',
      id: 'more',
      title: 'See all 19 results',
      group: '',
      query: 'mule',
    }
    list({ results: [MULE, more] })
    const row = screen.getAllByRole('option')[1] as HTMLElement
    expect(row.textContent).toBe('See all 19 results')
    expect(row.tagName).toBe('A')
    expect(row.getAttribute('href')).toBe('/more')
  })

  test('a search waiting on its index says it is searching (r4 F2)', () => {
    list({ ready: false })
    expect(screen.getByRole('status').textContent).toBe('Searching…')
  })
})
