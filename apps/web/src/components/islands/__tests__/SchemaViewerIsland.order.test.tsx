/**
 * A listing's trait filter, its sort and a phone's columns (RR-05, RR-06,
 * RR-08, RR-09, RR-23): each opens on the address's query and writes itself
 * back there, so a filtered, sorted view survives a reload and can be shared.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { RefEntity } from 'salvageunion-reference'
import { getModel, getUniqueSources, getUniqueTechLevels } from 'salvageunion-reference'
import { listingTraits } from '../../../lib/listingTraits'
import { formatSort, parseSort } from '../../../lib/useListingFilters'
import { IndexLedger } from '../IndexLedger'
import { SchemaViewerIsland } from '../SchemaViewerIsland'

/** A whole schema's listing renders past Bun's 5 s default under coverage. */
const HEAVY = 15_000

const all = (schemaId: string) => (getModel(schemaId)?.all() ?? []) as RefEntity[]

const names = () =>
  Array.from(document.querySelectorAll('.su-listing__groups tbody th a')).map(
    (a) => a.textContent ?? ''
  )

const heads = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('thead th')).map((th) => (th.textContent ?? '').trim())

function listing(schemaId: string) {
  const entities = all(schemaId)
  return render(
    <SchemaViewerIsland
      schemaId={schemaId}
      techLevels={getUniqueTechLevels(entities)}
      sources={getUniqueSources(entities)}
      traits={listingTraits(entities)}
    />
  )
}

afterEach(() => {
  cleanup()
  window.location.href = 'http://localhost/'
})

describe('a sort in the address', () => {
  it('reads `sp` as up by that column and `-sp` as down, and writes the same', () => {
    expect(parseSort('')).toBeUndefined()
    expect(parseSort('range')).toEqual({ key: 'range', descending: false })
    expect(parseSort('-range')).toEqual({ key: 'range', descending: true })
    expect(formatSort(parseSort('-range'))).toBe('-range')
    expect(formatSort(undefined)).toBe('')
  })

  it(
    'a listing opened on ?sort=-name is sorted, and says so',
    () => {
      window.location.href = 'http://localhost/chassis/?sort=-name'
      listing('chassis')
      const sorted = all('chassis')
        .map((e) => e.name)
        .sort((a, b) => b.localeCompare(a))
      expect(names()).toEqual(sorted)
      expect(screen.getByText('Sorted by Name, Z to A.')).toBeTruthy()
    },
    HEAVY
  )

  it(
    'pressing a column writes the sort to the address; Book order takes it off',
    () => {
      listing('chassis')
      // Unsorted, the list says whose order it is in (RR-09).
      expect(screen.getByText(/In the book’s order/)).toBeTruthy()
      // The Tech Level sorts from the head strip, as every column does (RR-09):
      // its stamp stands over the rows' own, and no button beside the list.
      expect(screen.queryByRole('button', { name: 'Sort by Tech Level' })).toBeNull()
      const rank = screen.getByRole('button', { name: 'Sort by TL (Tech Level)' })
      expect(rank.closest('thead')).not.toBeNull()
      fireEvent.click(rank)
      expect(window.location.search).toBe('?sort=tl')
      expect(screen.getByText('Sorted by Tech Level, low to high.')).toBeTruthy()
      expect(rank.closest('th')?.getAttribute('aria-sort')).toBe('ascending')
      fireEvent.click(rank)
      expect(window.location.search).toBe('?sort=-tl')
      fireEvent.click(screen.getByRole('button', { name: 'Book order' }))
      expect(window.location.search).toBe('')
    },
    HEAVY
  )

  it(
    'by Tech Level: the numbered levels in order, the lettered ones after',
    () => {
      window.location.href = 'http://localhost/chassis/?sort=tl'
      listing('chassis')
      const levels = Array.from(document.querySelectorAll('.su-listing__groups tbody th')).map(
        (th) => (th.textContent ?? '').match(/TL(\w+)$/)?.[1] ?? ''
      )
      const rank = (level: string) => (/^\d+$/.test(level) ? Number(level) : 99)
      expect(levels.length).toBeGreaterThan(10)
      expect(levels).toEqual([...levels].sort((a, b) => rank(a) - rank(b)))
    },
    HEAVY
  )
})

describe('the trait filter (RR-05)', () => {
  it('offers a listing its traits only where its entities carry them', () => {
    expect(listingTraits(all('systems'))).toContain('Hot')
    expect(listingTraits(all('equipment')).length).toBeGreaterThan(1)
    expect(listingTraits(all('classes'))).toEqual([])
  })

  it(
    '?trait=Hot lists the Hot systems, with a token that takes the filter off',
    () => {
      window.location.href = 'http://localhost/systems/?trait=Hot'
      const { container } = listing('systems')
      const shown = names()
      expect(shown.length).toBeGreaterThan(3)
      expect(shown.length).toBeLessThan(all('systems').length)
      const at = heads(container).indexOf('Traits')
      const traitCells = Array.from(container.querySelectorAll('.su-listing__groups tbody tr')).map(
        (row) => row.children[at]?.textContent ?? ''
      )
      expect(traitCells.every((cell) => cell.split(', ').includes('Hot'))).toBe(true)
      const rail = container.querySelector<HTMLElement>('.su-rail') as HTMLElement
      expect(
        (within(rail).getByRole('combobox', { name: 'Trait' }) as HTMLSelectElement).value
      ).toBe('Hot')
      fireEvent.click(screen.getByRole('button', { name: 'Remove trait Hot' }))
      expect(names().length).toBe(all('systems').length)
      expect(window.location.search).toBe('')
    },
    HEAVY
  )
})

describe("the List's columns", () => {
  it('the systems carry a Traits column after DMG', () => {
    const { container } = render(
      <IndexLedger schemaId="systems" noun="Systems" items={all('systems')} />
    )
    const labels = heads(container)
    expect(labels).toContain('Traits')
    expect(labels.indexOf('Traits')).toBe(labels.indexOf('DMG') + 1)
  })

  it('a stat that repeats another on every row is left to the Page (RR-23)', () => {
    const { container } = render(
      <IndexLedger schemaId="bio-titans" noun="Bio-Titans" items={all('bio-titans')} />
    )
    expect(heads(container)).toContain('SP')
    expect(heads(container)).not.toContain('BIO')
  })

  it('a list with no Tech Levels has no rank to sort by', () => {
    const { container } = render(
      <IndexLedger schemaId="keywords" noun="Keywords" items={all('keywords')} />
    )
    expect(container.querySelector('.su-ledger__rank')).toBeNull()
  })

  it('a Hybrid Class’s line names the Core trees it branches into (RR-23)', () => {
    const hybrids = all('classes').filter((item) => !('coreTrees' in item))
    const { container } = render(
      <IndexLedger schemaId="classes" noun="Hybrid Classes" items={hybrids} />
    )
    const at = heads(container).indexOf('Core Trees')
    expect(at).toBeGreaterThan(0)
    const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
      tr.textContent?.startsWith('Fabricator')
    )
    expect(row?.children[at]?.textContent).toBe('Forging, Electronics')
  })

  it('a list of many columns is dense, a list of few is not (RR-24’s frame)', () => {
    const chassis = render(<IndexLedger schemaId="chassis" noun="Chassis" items={all('chassis')} />)
    expect(chassis.container.querySelector('table')?.hasAttribute('data-dense')).toBe(true)
    cleanup()
    const traits = render(<IndexLedger schemaId="traits" noun="Traits" items={all('traits')} />)
    expect(traits.container.querySelector('table')?.hasAttribute('data-dense')).toBe(false)
  })

  it('a phone’s two columns are the reader’s, from ?cols= (RR-06)', () => {
    window.location.href = 'http://localhost/systems/?cols=range,damage'
    const { container } = listing('systems')
    const onPhone = Array.from(container.querySelectorAll('thead th[data-phone]'))
      .map((th) => (th.textContent ?? '').trim())
      .filter(Boolean)
    expect(onPhone).toEqual(['RNG', 'DMG'])
    const slots = within(screen.getByRole('group', { name: 'Columns' })).getAllByRole('combobox')
    expect(slots.map((slot) => (slot as HTMLSelectElement).value)).toEqual(['range', 'damage'])
    fireEvent.change(slots[0] as HTMLElement, { target: { value: 'action' } })
    expect(new URLSearchParams(window.location.search).get('cols')).toBe('action,damage')
  })
})
