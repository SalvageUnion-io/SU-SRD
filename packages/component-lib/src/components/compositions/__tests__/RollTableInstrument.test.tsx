/**
 * The roll, at the bar's far right: given `onRoll`, it is the table's one
 * roll control, the shared Button ("Roll the Die") named for its table;
 * without it, or in server markup, it is the plain "ROLL THE DIE:" stamp, so
 * static HTML never carries a dead button. A rolled row's pennant is pinned
 * out of the flow, so the row's content is the same rolled or not.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RollTableInstrument } from '../RollTableInstrument'

const rows = [
  { key: '20', label: 'Nailed it', value: 'You succeed.' },
  { key: '1-19', label: 'Not quite', value: 'You do not.' },
]

const instrument = (onRoll?: () => void) => (
  <RollTableInstrument
    name="Core Mechanic"
    size="large"
    onRoll={onRoll}
    table={{ kind: 'bands', rows }}
  />
)

describe('RollTableInstrument — the roll', () => {
  test('with onRoll, a Button at the bar’s end is the one roll control, named for its table', () => {
    let rolled = 0
    const { container } = render(instrument(() => rolled++))
    const controls = screen.getAllByRole('button')
    expect(controls).toHaveLength(1)
    const roll = screen.getByRole('button', { name: 'Roll the die on Core Mechanic' })
    expect(roll.textContent).toBe('Roll the Die')
    expect(roll.className).toContain('su-btn')
    expect(roll.className).toContain('su-roll__roll')
    expect(roll.className).not.toContain('su-roll__stamp')
    expect(container.querySelector('.su-roll__bar')?.contains(roll)).toBe(true)
    expect(roll.nextElementSibling).toBeNull()
    fireEvent.click(roll)
    expect(rolled).toBe(1)
  })

  test('a columns table names its roll by its own words', () => {
    render(
      <RollTableInstrument
        name="Callsign Table"
        size="large"
        stamp="Roll twice:"
        onRoll={() => {}}
        table={{ kind: 'columns', columns: [] }}
      />
    )
    expect(screen.getByRole('button', { name: 'Roll twice on Callsign Table' }).textContent).toBe(
      'Roll twice'
    )
  })

  test('without onRoll, the roll is the plain stamp, in the same place', () => {
    render(instrument())
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText('Roll the Die:').tagName).toBe('SPAN')
  })

  test('server markup prints the stamp, never a dead button, even with onRoll', () => {
    const html = renderToStaticMarkup(instrument(() => {}))
    expect(html).toContain('<span class="su-roll__stamp su-roll__roll">Roll the Die:</span>')
    expect(html).not.toContain('<button')
  })
})

describe('RollTableInstrument — the rolled row', () => {
  test('pins its pennant beside the row’s content, adding no line to it', () => {
    const marked = (mark?: { key: string; roll: number }) => {
      const { container, unmount } = render(
        <RollTableInstrument
          name="Core Mechanic"
          size="large"
          table={{ kind: 'bands', rows, mark }}
        />
      )
      const row = container.querySelectorAll('.su-roll__row')[1] as HTMLElement
      const body = row.querySelector('.su-roll__body') as HTMLElement
      const shape = [...body.children].map((child) => child.className)
      const tag = body.querySelector('.su-roll__tag')?.textContent ?? null
      unmount()
      return { shape, tag }
    }
    const before = marked()
    const after = marked({ key: '1-19', roll: 7 })
    expect(after.tag).toBe('Rolled 7')
    // The same head and value as unrolled; the pennant is the one addition.
    expect(after.shape).toEqual([...before.shape, 'su-roll__tag'])
  })
})

describe('RollTableInstrument — the ink head’s column labels', () => {
  const inked = (split: boolean) => (
    <RollTableInstrument
      name="Core Mechanic"
      size="large"
      onRoll={() => {}}
      table={{ kind: 'bands', rows, split }}
    />
  )

  test('labels the columns for sight only, the roll still the one button at its end', () => {
    const { container } = render(inked(false))
    const bar = container.querySelector('.su-roll__bar')
    expect(bar?.querySelector('[aria-hidden="true"]')?.textContent).toBe('d20Result')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(bar?.lastElementChild?.lastElementChild).toBe(
      screen.getByRole('button', { name: 'Roll the die on Core Mechanic' })
    )
  })

  test('a split table repeats Result over its second half', () => {
    const { container } = render(inked(true))
    expect(container.querySelector('.su-roll__bar')?.getAttribute('data-split')).toBe('true')
    expect(container.querySelectorAll('.su-roll__col-text')).toHaveLength(2)
  })

  test('a bar carrying the host’s title has no column labels', () => {
    const { container } = render(
      <RollTableInstrument
        name="Core Mechanic"
        title="Core Mechanic"
        size="medium"
        table={{ kind: 'bands', rows }}
      />
    )
    expect(container.querySelector('.su-roll__cols')).toBeNull()
  })
})
