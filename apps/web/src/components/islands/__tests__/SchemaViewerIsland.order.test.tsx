/**
 * A listing's trait filter, its sort and a phone's columns (RR-05, RR-06,
 * RR-08, RR-09, RR-23): each opens on the address's query and writes itself
 * back there, so a filtered, sorted view survives a reload and can be shared.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { RefEntity } from 'salvageunion-reference'
import { getModel, getUniqueSources, getUniqueTechLevels } from 'salvageunion-reference'
import { listingFieldFacets } from '../../../lib/listingFacets'
import { listingTraits } from '../../../lib/listingTraits'
import { formatSort, parseSort } from '../../../lib/useListingFilters'
import { IndexLedger } from '../IndexLedger'
import { compareCells, indexLeadStat } from '../indexColumns.model'
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
      // A number column's first press is highest first (r4 F5).
      fireEvent.click(rank)
      expect(window.location.search).toBe('?sort=-tl')
      expect(screen.getByText('Sorted by Tech Level, high to low.')).toBeTruthy()
      expect(rank.closest('th')?.getAttribute('aria-sort')).toBe('descending')
      fireEvent.click(rank)
      expect(window.location.search).toBe('?sort=tl')
      fireEvent.click(screen.getByRole('button', { name: 'Book order' }))
      expect(window.location.search).toBe('')
    },
    HEAVY
  )

  it(
    'a number column sorts highest first on its first press; a word column, A to Z (r4 F5)',
    () => {
      listing('chassis')
      fireEvent.click(screen.getByRole('button', { name: /^Sort by SP/ }))
      expect(window.location.search).toMatch(/^\?sort=-/)
      fireEvent.click(screen.getByRole('button', { name: 'Sort by Name' }))
      expect(window.location.search).toBe('?sort=name')
      expect(screen.getByText('Sorted by Name, A to Z.')).toBeTruthy()
    },
    HEAVY
  )

  it(
    'the Abilities list runs A to Z and says so, never "the book’s order" (r4 F5)',
    () => {
      listing('abilities')
      const shown = names()
      expect(shown).toEqual([...shown].sort((a, b) => a.localeCompare(b)))
      expect(screen.getByText(/^A to Z\./)).toBeTruthy()
      expect(screen.queryByText(/In the book’s order/)).toBeNull()
      // The way back from a sort names that order too.
      fireEvent.click(screen.getByRole('button', { name: 'Sort by Name' }))
      fireEvent.click(screen.getByRole('button', { name: 'Sort by Name' }))
      expect(screen.getByRole('button', { name: 'A to Z' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Book order' })).toBeNull()
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

describe('sorting by damage (r2 H3)', () => {
  const cells = ['2d20 SP', '3 SP', '', 'X SP', '9 SP', '', '4 SP', '1d6 HP']

  it('low to high: numbers and dice (by their average) in order, then X, then the blanks', () => {
    expect([...cells].sort((a, b) => compareCells(a, b, false))).toEqual([
      '3 SP',
      '1d6 HP',
      '4 SP',
      '9 SP',
      '2d20 SP',
      'X SP',
      '',
      '',
    ])
  })

  it('high to low: the values run down, and X and the blanks still trail', () => {
    expect([...cells].sort((a, b) => compareCells(a, b, true))).toEqual([
      '2d20 SP',
      '9 SP',
      '4 SP',
      '1d6 HP',
      '3 SP',
      'X SP',
      '',
      '',
    ])
  })

  it(
    'the List puts no blank above a system that deals damage, in either direction',
    () => {
      for (const sort of ['damage', '-damage']) {
        window.location.href = `http://localhost/systems/?trait=Hot&sort=${sort}`
        const { container } = listing('systems')
        const at = heads(container).indexOf('DMG')
        const dmg = Array.from(container.querySelectorAll('.su-listing__groups tbody tr')).map(
          (row) => (row.children[at]?.textContent ?? '').replace('—', '').trim()
        )
        const firstBlank = dmg.indexOf('')
        if (firstBlank !== -1) expect(dmg.slice(firstBlank).every((cell) => cell === '')).toBe(true)
        expect(dmg[0]).not.toBe('')
        expect(dmg[0]?.startsWith('X')).toBe(false)
        cleanup()
      }
    },
    HEAVY
  )

  it(
    'the Catalog keeps the sort the address names',
    () => {
      window.location.href = 'http://localhost/chassis/?tl=3&sort=-name&view=catalog'
      const { container } = listing('chassis')
      const tiles = Array.from(container.querySelectorAll('.su-listing__tiles > li')).map(
        (tile) => tile.querySelector('a')?.getAttribute('href') ?? ''
      )
      expect(tiles.length).toBeGreaterThan(2)
      expect(tiles).toEqual([...tiles].sort((a, b) => b.localeCompare(a)))
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
      expect(
        traitCells.every((cell) => cell.split(', ').some((trait) => /^Hot( |$)/.test(trait)))
      ).toBe(true)
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

describe('a phone’s filter panel (r5 E8)', () => {
  it(
    'folds on a menu’s choice, so the list it changed is in view; a Tech Level leaves it open',
    () => {
      const { container } = listing('systems')
      const rail = container.querySelector<HTMLElement>('.su-rail') as HTMLElement
      const filters = within(rail).getByRole('button', { name: /^Filters/ })
      fireEvent.click(filters)
      expect(filters.getAttribute('aria-expanded')).toBe('true')
      fireEvent.click(within(rail).getByRole('button', { name: 'Tech Level 1' }))
      expect(filters.getAttribute('aria-expanded')).toBe('true')
      fireEvent.change(within(rail).getByRole('combobox', { name: 'Trait' }), {
        target: { value: 'Hot' },
      })
      expect(filters.getAttribute('aria-expanded')).toBe('false')
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

  it('the Traits column shows each trait’s value, and a cost few rows carry is the column a narrow frame spares (r5 E8)', () => {
    const { container } = render(
      <IndexLedger schemaId="systems" noun="Systems" items={all('systems')} />
    )
    const at = heads(container).indexOf('Traits')
    const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
      tr.querySelector('th')?.textContent?.startsWith('Blue Mining Laser')
    )
    expect(row?.children[at]?.textContent).toBe('Energy, Hot 3')
    const cost = Array.from(container.querySelectorAll('thead th')).find((th) =>
      th.textContent?.includes('Cost')
    )
    expect(cost?.hasAttribute('data-spare')).toBe(true)
    const traits = container.querySelectorAll('thead th')[at]
    expect(traits?.hasAttribute('data-spare')).toBe(false)
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

  const phoneHeads = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('thead th[data-phone]'))
      .map((th) => (th.textContent ?? '').trim())
      .filter(Boolean)
  const slotValues = () =>
    within(screen.getByRole('group', { name: 'Columns' }))
      .getAllByRole('combobox')
      .map((slot) => (slot as HTMLSelectElement).value)

  it(
    'Equipment opens a phone on two real columns, and its two menus name them (r2 H2)',
    () => {
      const { container } = listing('equipment')
      const shown = phoneHeads(container)
      expect(shown.length).toBe(2)
      const [first, second] = slotValues()
      expect(first).toBeTruthy()
      expect(second).toBeTruthy()
      expect(first).not.toBe(second)
      // No quiet line stands in for the columns.
      expect(container.querySelector('table[data-phone-line]')).toBeNull()
    },
    HEAVY
  )

  it(
    'a choice lands in the column it was made in (r2 H2)',
    () => {
      const { container } = listing('chassis')
      const before = slotValues()
      expect(before.length).toBe(2)
      const second = phoneHeads(container)[1]
      const options = Array.from(
        within(screen.getByRole('group', { name: 'Columns' }))
          .getAllByRole('combobox')[0]
          ?.querySelectorAll('option') ?? []
      ).map((option) => option.value)
      // A column drawn AFTER the second slot's, chosen for the first slot.
      const later = options[options.length - 1] as string
      expect(before).not.toContain(later)
      const slots = within(screen.getByRole('group', { name: 'Columns' })).getAllByRole('combobox')
      fireEvent.change(slots[0] as HTMLElement, { target: { value: later } })
      expect(slotValues()).toEqual([later, before[1] as string])
      expect(new URLSearchParams(window.location.search).get('cols')).toBe(`${later},${before[1]}`)
      // The table draws the first slot's column first.
      const now = phoneHeads(container)
      expect(now.length).toBe(2)
      expect(now[1]).toBe(second as string)
    },
    HEAVY
  )
})

describe("a kind's one stat, for a chapter's index (RR-18)", () => {
  it('is the List’s first measure, by its short label', () => {
    const chassis = all('chassis')
    const statOf = indexLeadStat('chassis', chassis)
    expect(chassis.every((item) => /^SP \d+$/.test(statOf(item) ?? ''))).toBe(true)
  })

  it('is nothing where the kind has no measure and few entries pay a cost', () => {
    const equipment = all('equipment')
    const statOf = indexLeadStat('equipment', equipment)
    expect(equipment.some((item) => statOf(item) !== undefined)).toBe(false)
    const keywords = all('keywords')
    expect(indexLeadStat('keywords', keywords)(keywords[0] as RefEntity)).toBeUndefined()
  })
})

describe('Systems by Range, Action and Weapons only (r4 F6)', () => {
  const column = (container: HTMLElement, label: string) => {
    const at = heads(container).indexOf(label)
    return Array.from(container.querySelectorAll('.su-listing__groups tbody tr')).map((row) =>
      (row.children[at]?.textContent ?? '').replace('—', '').trim()
    )
  }

  it('the facets come from what the List prints: the bands in the book’s order, the action types', () => {
    const fields = listingFieldFacets('systems', all('systems'))
    expect(fields?.ranges).toEqual(['Close', 'Medium', 'Long', 'Far'])
    expect(fields?.actions).toContain('Turn')
    expect(fields?.actions).toContain('Reaction')
    expect(fields?.weapons).toBe(true)
    // Systems alone: no other listing grew a filter.
    expect(listingFieldFacets('modules', all('modules'))).toBeUndefined()
    expect(listingFieldFacets('chassis', all('chassis'))).toBeUndefined()
  })

  it(
    '?range=Long&action=Turn&weapons=1 lists the Turn weapons that reach Long, each filter a token',
    () => {
      window.location.href = 'http://localhost/systems/?range=Long&action=Turn&weapons=1'
      const entities = all('systems')
      const { container } = render(
        <SchemaViewerIsland
          schemaId="systems"
          techLevels={getUniqueTechLevels(entities)}
          sources={getUniqueSources(entities)}
          traits={listingTraits(entities)}
          fields={listingFieldFacets('systems', entities)}
        />
      )
      const shown = names()
      expect(shown.length).toBeGreaterThan(2)
      expect(shown.length).toBeLessThan(entities.length)
      expect(shown).toContain('Railgun')
      expect(column(container, 'RNG').every((cell) => cell.split(' / ').includes('Long'))).toBe(
        true
      )
      expect(column(container, 'Action').every((cell) => cell === 'Turn')).toBe(true)
      expect(column(container, 'DMG').every((cell) => cell !== '')).toBe(true)
      const rail = container.querySelector<HTMLElement>('.su-rail') as HTMLElement
      expect(
        (within(rail).getByRole('combobox', { name: 'Range' }) as HTMLSelectElement).value
      ).toBe('Long')
      expect(
        within(rail).getByRole('button', { name: 'Weapons only' }).getAttribute('aria-pressed')
      ).toBe('true')
      // Each comes off by its token, and the address follows.
      fireEvent.click(screen.getByRole('button', { name: 'Remove range Long' }))
      fireEvent.click(screen.getByRole('button', { name: 'Remove action Turn' }))
      expect(window.location.search).toBe('?weapons=1')
      fireEvent.click(screen.getByRole('button', { name: 'Remove weapons only' }))
      expect(window.location.search).toBe('')
      expect(names().length).toBe(entities.length)
    },
    HEAVY
  )
})
