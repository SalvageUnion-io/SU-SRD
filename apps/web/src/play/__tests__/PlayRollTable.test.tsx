/**
 * `PlayRollTable` — Play's roll table (the Tables column, a
 * Downtime step): the shared `RollTableInstrument` with this app's host around
 * it. The instrument's own anatomy is the library's test; this file clicks the
 * roll and follows the result path: the mark, the toast, the hand-off to the
 * Game log, Copy, the picker trigger, and the two-roll columns variant.
 *
 * **The die.** The host takes its dice from `rollTableDice`, so that module is
 * replaced here with the real one plus a `rollD20` and a `dieForTable` that
 * serve a queue of chosen d20 values. `mock.module` is process-global (see
 * `.claude/rules/testing-patterns.md`), hence the capture-before-mock and the
 * `afterAll` restore.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Toaster } from '../../components/index'

/** The table's one roll control: the instrument's Roll the Die button. */
const ROLL_BUTTON = /^Roll (the die|twice) on /

/** d20 values the component will draw, in order. Refilled per test. */
let queued: number[] = []

function nextRoll(): number {
  const next = queued.shift()
  if (next === undefined) {
    throw new Error('roll queue exhausted — the component rolled more times than the test queued')
  }
  return next
}

// Capture before mocking: a module namespace is a live view, so the spread has
// to happen while it still reads as the real module.
const realDice = { ...(await import('../../lib/rollTableDice')) }

/** The table names the component asked a die for, in order. */
const asked: string[] = []

mock.module('../../lib/rollTableDice', () => ({
  ...realDice,
  rollD20: () => nextRoll(),
  dieForTable: async (tableName: string) => {
    asked.push(tableName)
    return () => nextRoll()
  },
}))

const { PlayRollTable } = await import('../PlayRollTable')

afterAll(async () => {
  mock.module('../../lib/rollTableDice', () => realDice)

  // Prove the restore took: a leaked mock would surface as "roll queue
  // exhausted" thrown from some unrelated file.
  const { rollD20 } = await import('../../lib/rollTableDice')
  const total = rollD20()
  if (!Number.isInteger(total) || total < 1 || total > 20) {
    throw new Error(`rollTableDice was not restored: rollD20() gave ${total}`)
  }
})

const copied: string[] = []

beforeAll(() => {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: (text: string) => {
        copied.push(text)
        return Promise.resolve()
      },
    },
  })
})

beforeEach(() => {
  queued = []
  asked.length = 0
  copied.length = 0
})

/** Press the roll and let the (async) die land. */
async function roll(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: ROLL_BUTTON }))
    await Promise.resolve()
  })
}

/** The rows (or cells) the instrument marks as rolled. */
const marked = () => [...document.querySelectorAll('.su-roll [aria-current="true"]')]

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A flat 1–20 table: `resultForTable` keys it by the raw roll. */
const FLAT_TABLE = {
  type: 'flat' as const,
  ...Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [`${i + 1}`, `Outcome ${i + 1}: it happens ${i + 1}`])
  ),
}

/** A range table, the shape most shipped tables use. */
const RANGE_TABLE = {
  type: 'standard' as const,
  '20': 'Nailed It: nothing goes wrong',
  '11-19': 'Success: it works',
  '2-10': 'Tough Choice: it works, but',
  '1': 'Cascade Failure: it all goes wrong',
}

const COLUMN_KEYS = ['1-4', '5-8', '9-12', '13-16', '17-20'] as const

/** A fully-populated columns table, so any (1–20, 1–20) pair resolves. */
const COLUMNS_TABLE = {
  type: 'columns' as const,
  ...Object.fromEntries(
    COLUMN_KEYS.map((col) => [
      col,
      Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`${i + 1}`, { value: `${col} entry ${i + 1}` }])
      ),
    ])
  ),
} as never

// ---------------------------------------------------------------------------

describe('rolling a standard table', () => {
  test('a roll marks exactly one row and raises its toast', async () => {
    queued = [7]
    render(
      <>
        <PlayRollTable table={RANGE_TABLE} name="Core Mechanic" />
        <Toaster />
      </>
    )
    expect(marked()).toHaveLength(0)

    await roll()

    // 7 falls in the 2-10 band, so that is the row that must be marked.
    expect(marked()).toHaveLength(1)
    expect(marked()[0]?.textContent).toContain('Tough Choice')
    expect(marked()[0]?.textContent).toContain('Rolled 7')
    expect(await screen.findByText('Core Mechanic: rolled 7 (2–10)')).toBeTruthy()
  })

  test('the table asks for its own die by name', async () => {
    queued = [7]
    render(<PlayRollTable table={RANGE_TABLE} name="Core Mechanic" />)
    await roll()
    expect(asked).toEqual(['Core Mechanic'])
    expect(queued).toEqual([])
  })

  test('the result is reported to the consumer (the Game log) with its label folded in', async () => {
    const reported: Array<[string, string]> = []
    queued = [20]
    render(
      <PlayRollTable
        table={RANGE_TABLE}
        name="Core Mechanic"
        onRollResult={(text, key) => reported.push([text, key])}
      />
    )

    await roll()

    expect(reported).toEqual([['Nailed It: nothing goes wrong', '20']])
  })

  test('the Roll the Die button is the one roll control, before and after a roll', async () => {
    queued = [20]
    render(<PlayRollTable table={RANGE_TABLE} name="Core Mechanic" />)
    const rolls = () => screen.queryAllByRole('button', { name: /^Roll/ })
    expect(rolls().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Roll the die on Core Mechanic',
    ])
    expect(screen.queryByLabelText('Copy result to clipboard')).toBeNull()
    await roll()
    // The bar gains Copy, with no Reroll beside it.
    expect(rolls()).toHaveLength(1)
    expect(screen.queryByText('Reroll')).toBeNull()
    expect(screen.getByLabelText('Copy result to clipboard')).toBeTruthy()
  })

  test('rerolling moves the mark rather than adding one', async () => {
    queued = [1, 20]
    render(<PlayRollTable table={RANGE_TABLE} name="Core Mechanic" />)

    await roll()
    expect(marked()[0]?.textContent).toContain('Cascade Failure')

    await roll()

    expect(marked()).toHaveLength(1)
    expect(marked()[0]?.textContent).toContain('Nailed It')
    expect(screen.queryAllByLabelText('Copy result to clipboard')).toHaveLength(1)
  })

  test('Copy puts the labelled result text on the clipboard', async () => {
    queued = [20]
    render(<PlayRollTable table={RANGE_TABLE} name="Core Mechanic" />)
    await roll()

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Copy result to clipboard'))
      await Promise.resolve()
    })

    expect(copied).toEqual(['Nailed It: nothing goes wrong'])
  })

  test('a flat 1-20 table resolves on the rolled number itself', async () => {
    queued = [13]
    const reported: string[] = []
    render(
      <PlayRollTable
        table={FLAT_TABLE}
        name="Flat"
        onRollResult={(_text, key) => reported.push(key)}
      />
    )

    await roll()

    expect(reported).toEqual(['13'])
    expect(marked()[0]?.textContent).toContain('it happens 13')
  })

  test('the bands are in the surface tone it is given', () => {
    const { container } = render(
      <PlayRollTable table={RANGE_TABLE} name="Core Mechanic" tone="red" />
    )
    const root = container.querySelector<HTMLElement>('.su-roll')
    expect(root?.style.getPropertyValue('--su-roll-band')).toContain('red')
  })
})

describe('the columns variant', () => {
  test('two rolls pick the column and the entry, and exactly that cell is marked', async () => {
    // 9 lands in the 9-12 column; 3 picks entry 3 within it.
    queued = [9, 3]
    const reported: Array<[string, string]> = []
    render(
      <>
        <PlayRollTable
          table={COLUMNS_TABLE}
          name="NPC Generator"
          onRollResult={(text, key) => reported.push([text, key])}
        />
        <Toaster />
      </>
    )
    expect(screen.getByRole('button', { name: 'Roll twice on NPC Generator' })).toBeTruthy()

    await roll()

    expect(marked()).toHaveLength(1)
    expect(marked()[0]?.textContent).toBe('9-12 entry 3')
    expect(document.querySelector('th[data-rolled="true"]')?.textContent).toBe('9–12')
    expect(reported).toEqual([['9-12 entry 3', '3']])
    expect(await screen.findByText('NPC Generator: rolled 3 (column 9–12)')).toBeTruthy()
  })

  test('the column is chosen by range, not by the raw number', async () => {
    // 17..20 all share one column, so the boundary is the thing worth pinning.
    queued = [17, 1]
    render(<PlayRollTable table={COLUMNS_TABLE} name="NPC Generator" />)

    await roll()

    expect(marked()[0]?.textContent).toBe('17-20 entry 1')
  })

  test('rolling again moves the mark', async () => {
    queued = [1, 1, 20, 20]
    render(<PlayRollTable table={COLUMNS_TABLE} name="NPC Generator" />)

    await roll()
    expect(marked()[0]?.textContent).toBe('1-4 entry 1')

    await roll()

    expect(marked()).toHaveLength(1)
    expect(marked()[0]?.textContent).toBe('17-20 entry 20')
  })

  test('every column renders all 20 of its entries', () => {
    render(<PlayRollTable table={COLUMNS_TABLE} name="NPC Generator" />)

    for (const col of COLUMN_KEYS) {
      expect(screen.getByRole('columnheader', { name: col.replace('-', '–') })).toBeTruthy()
      expect(screen.getByText(`${col} entry 20`)).toBeTruthy()
    }
    // 5 columns x 20 rows.
    expect(document.querySelectorAll('tbody td.su-roll__cell')).toHaveLength(100)
  })
})
