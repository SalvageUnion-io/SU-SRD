/**
 * The Ledger (ledger.md L1 to L9): a compared or picked list
 * as one framed table. This file pins the drawing: one frame in the band's
 * paint, the title on the head strip's cut-out tab, mini ink stamps over the
 * columns, `—` for none, the sources on the cite foot, and in select a radio
 * a row with the picked row inked.
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, within } from '@testing-library/react'
import type { LedgerColumn, LedgerRow } from '../Ledger'
import { Ledger } from '../Ledger'

const COLUMNS: readonly LedgerColumn[] = [
  { key: 'slots', label: 'Slots', title: 'Slots', kind: 'figure', phone: true },
  { key: 'rng', label: 'RNG', title: 'Range', kind: 'text' },
  { key: 'traits', label: 'Traits', kind: 'quiet' },
]

const ROWS: readonly LedgerRow[] = [
  {
    id: 'a',
    name: 'Red Laser',
    entityRef: undefined,
    href: '/systems/red-laser/',
    cells: [3, 'Long', 'Energy'],
  },
  {
    id: 'b',
    name: 'Locker',
    entityRef: undefined,
    href: '/systems/locker/',
    cells: [0, '', undefined],
  },
]

const draw = (props: Partial<Parameters<typeof Ledger>[0]> = {}) =>
  render(
    <Ledger
      tone="mech"
      nameLabel="Systems"
      label="Systems"
      columns={COLUMNS}
      rows={ROWS}
      {...props}
    />
  )

const bodyRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLTableRowElement>('tbody > tr'))

describe('Ledger: one framed table (L1, L2)', () => {
  test('one frame holds one table; no row wears a frame or band of its own', () => {
    const { container } = draw()
    expect(container.querySelectorAll('.su-ledger')).toHaveLength(1)
    expect(container.querySelectorAll('table')).toHaveLength(1)
    expect(container.querySelector('table')?.getAttribute('aria-label')).toBe('Systems')
    expect(container.querySelector('tbody .su-box, tbody [data-grain]')).toBeNull()
  })

  test('the title is the cut-out tab on the head strip; a plain row count is not printed', () => {
    const { container } = draw({ count: 2 })
    const tab = container.querySelector('thead .su-entity-compact__notch')
    expect(tab?.querySelector('.su-entity-compact__title')?.textContent).toBe('Systems')
    expect(tab?.querySelector('.su-ledger__count')).toBeNull()
  })

  test('a budget beside the title is printed', () => {
    const { container } = draw({ count: '7/7' })
    const tab = container.querySelector('thead .su-entity-compact__notch')
    expect(tab?.querySelector('.su-ledger__count')?.textContent).toBe('7/7')
  })

  test('each column label is a mini ink stamp over its column', () => {
    const { container } = draw()
    const heads = Array.from(container.querySelectorAll('thead th')).slice(1)
    expect(heads.map((th) => th.textContent)).toEqual(['Slots', 'RNG', 'Traits'])
    for (const th of heads) expect(th.querySelector('[class*="su-badge"]')).not.toBeNull()
  })

  test('a mark stands beside the tab on the band (HOMEBREW)', () => {
    const { container } = draw({ mark: <span data-testid="mark">Homebrew</span> })
    const line = container.querySelector('.su-ledger__title-line')
    expect(line && within(line as HTMLElement).getByTestId('mark')).toBeTruthy()
  })
})

describe('Ledger: rows and columns (L4, L5)', () => {
  test("the name leads its row and is the row's one link", () => {
    const { container } = draw()
    const [first] = bodyRows(container)
    expect(first?.querySelector('th[scope="row"] a')?.textContent).toBe('Red Laser')
    expect(first?.querySelectorAll('a')).toHaveLength(1)
  })

  test('an absent value is a dash; a zero is a value', () => {
    const { container } = draw()
    const cells = Array.from(bodyRows(container)[1]?.querySelectorAll('td') ?? [])
    expect(cells.map((td) => td.textContent)).toEqual(['0', '—', '—'])
    expect(cells.map((td) => td.hasAttribute('data-empty'))).toEqual([false, true, true])
  })

  test('every row has a cell a column, in the columns order', () => {
    const { container } = draw()
    for (const row of bodyRows(container)) {
      expect(Array.from(row.querySelectorAll('td')).map((td) => td.dataset.kind)).toEqual([
        'figure',
        'text',
        'quiet',
      ])
    }
  })
})

describe('Ledger: the foot (L6)', () => {
  test('the sources print once, on the cite foot', () => {
    const { container } = draw({ foot: 'Workshop Manual · p.162' })
    const frame = container.querySelector('.su-ledger')
    expect(frame?.textContent).toContain('Workshop Manual · p.162')
    expect(frame?.querySelector('table')?.textContent).not.toContain('Workshop Manual')
  })

  test('a list with no source draws no foot', () => {
    const { container } = draw()
    const table = container.querySelector('.su-ledger table')
    expect(table?.parentElement?.children).toHaveLength(1)
  })
})

describe('Ledger: a head stamp sorts only where the list asks (L2)', () => {
  test('a read Ledger has no button in its head', () => {
    const { container } = draw()
    expect(container.querySelector('thead button')).toBeNull()
  })

  test('with onSort each stamp and the tab sort, and the sorted column says so', () => {
    const onSort = mock((_key: string) => {})
    const { container, getByRole } = draw({ onSort, sort: { key: 'slots', descending: true } })
    fireEvent.click(getByRole('button', { name: 'Sort by RNG (Range)' }))
    fireEvent.click(getByRole('button', { name: 'Sort by Systems' }))
    expect(onSort.mock.calls.map(([key]) => key)).toEqual(['rng', 'name'])
    const sorted = container.querySelector('thead th[aria-sort]')
    expect(sorted?.getAttribute('aria-sort')).toBe('descending')
    expect(sorted?.textContent).toContain('Slots')
  })

  test('sortTab false: the stamps sort and the tab stays a title (L2, a mark beside it)', () => {
    const { container, getByRole, queryByRole } = draw({ onSort: () => {}, sortTab: false })
    expect(getByRole('button', { name: 'Sort by RNG (Range)' })).toBeTruthy()
    expect(queryByRole('button', { name: 'Sort by Systems' })).toBeNull()
    expect(container.querySelector('.su-entity-compact__notch button')).toBeNull()
  })
})

describe('Ledger: a picker is the same Ledger in select (L7)', () => {
  test('each row is a radio of one group; the picked row is inked and links nowhere', () => {
    const onSelect = mock((_id: string) => {})
    const { container, getAllByRole } = draw({ select: { selected: 'b', onSelect } })
    const radios = getAllByRole('radio') as HTMLInputElement[]
    expect(radios).toHaveLength(2)
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1)
    expect(radios.map((radio) => radio.checked)).toEqual([false, true])
    const rows = bodyRows(container)
    expect(rows.map((row) => row.hasAttribute('data-picked'))).toEqual([false, true])
    expect(container.querySelector('tbody a')).toBeNull()
    fireEvent.click(radios[0] as HTMLInputElement)
    expect(onSelect).toHaveBeenCalledWith('a')
  })

  test('a row that cannot be picked wears the one dim and says why', () => {
    const rows = [ROWS[0] as LedgerRow, { ...(ROWS[1] as LedgerRow), blocked: 'No slots left' }]
    const { container } = draw({ rows, select: { selected: 'a', onSelect: () => {} } })
    const blocked = bodyRows(container)[1]
    expect(blocked?.hasAttribute('data-blocked')).toBe(true)
    expect(blocked?.title).toBe('No slots left')
  })

  test("the pick's card opens under its row", () => {
    const rows = [{ ...(ROWS[0] as LedgerRow), detail: <p>The card</p> }, ROWS[1] as LedgerRow]
    const { container } = draw({ rows, select: { selected: 'a', onSelect: () => {} } })
    expect(container.querySelector('tr.su-ledger__detail')?.textContent).toBe('The card')
  })
})

describe('Ledger: an empty list', () => {
  test('says so in its body', () => {
    const { container } = draw({ rows: [], empty: 'No systems yet.' })
    expect(container.querySelector('tbody')?.textContent).toBe('No systems yet.')
  })
})

describe('rules markup in a cell', () => {
  test('a [[Trait]] renders as words, never as markup, in the cell and its title', () => {
    const { container } = draw({
      rows: [
        {
          id: 'h',
          name: 'Override',
          entityRef: undefined,
          href: '/abilities/override/',
          cells: [1, '', 'Use an Ability with the [[Hacking]] Trait'],
        },
      ],
    })
    expect(container.innerHTML).not.toContain('[[')
    expect(container.textContent).toContain('the Hacking Trait')
    expect(container.querySelectorAll('a')).toHaveLength(1)
  })
})
