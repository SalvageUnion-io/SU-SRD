/**
 * `RollTable` — the only surface in the library that *does* something when you
 * click it, and until now the only large one with no direct test. Three other
 * files assert the Roll button **renders**; none had ever clicked it, so the
 * entire result path (announce, highlight, reroll, clear, copy, and the whole
 * two-roll columns variant) was uncovered.
 *
 * Two seams make that testable without a production change:
 *
 *  - **The die.** `RollTable.tsx` calls `roll('1d20')` inline with no injected
 *    roller, so `@randsum/roller` is replaced here with a queue of chosen d20
 *    values. `mock.module` is process-global (see
 *    `.claude/rules/testing-patterns.md`), hence the capture-before-mock and
 *    the `afterAll` restore — `rollTableHelpers.ts` and `mechRollTables.ts`
 *    roll for real, and must keep doing so in every file that runs after this
 *    one.
 *  - **The reveal delay.** Both variants set state inside a 300ms
 *    `setTimeout`, so tests drive fake timers rather than sleeping.
 *
 * Assertions are about *behaviour a player would notice*: what the live region
 * announces, which single row is marked selected, and whether rerolling
 * replaces the previous answer instead of accumulating answers.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  mock,
  test,
} from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'

const ROLL_BUTTON = 'Roll on this table'
/** The reveal delay both variants wrap their state update in. */
const REVEAL_MS = 300

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
const realRoller = { ...(await import('@randsum/roller')) }

mock.module('@randsum/roller', () => ({
  ...realRoller,
  roll: () => ({ total: nextRoll() }),
}))

const { RollTable } = await import('../RollTable')

afterAll(async () => {
  mock.module('@randsum/roller', () => realRoller)

  // Prove the restore actually took. No other component-lib test rolls, so a
  // leaked mock would surface as "roll queue exhausted" thrown from some
  // unrelated file — exactly the confusing, far-away failure the
  // capture-and-restore dance exists to prevent. Assert it here instead.
  const { roll } = await import('@randsum/roller')
  const total = roll('1d20').total
  if (!Number.isInteger(total) || total < 1 || total > 20) {
    throw new Error(`@randsum/roller was not restored: roll('1d20') gave ${String(total)}`)
  }
})

// ---------------------------------------------------------------------------
// Environment: happy-dom has neither of these, and both are on the roll path.
// ---------------------------------------------------------------------------

const copied: string[] = []

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined
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
  copied.length = 0
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

/** Click Roll and run out the 300ms reveal. */
function rollAndReveal(): void {
  fireEvent.click(screen.getByLabelText(ROLL_BUTTON))
  act(() => {
    jest.advanceTimersByTime(REVEAL_MS)
  })
}

/** Click a result-bar action by its visible label and run out any reveal. */
function clickAction(label: string): void {
  fireEvent.click(screen.getByText(label))
  act(() => {
    jest.advanceTimersByTime(REVEAL_MS)
  })
}

/** The single `role="status"` live region each variant renders. */
function announcement(): string {
  return screen.getByRole('status').textContent ?? ''
}

/**
 * Text queries must skip the live region, which by design repeats the rolled
 * result verbatim — without this every "is the result on screen" assertion
 * matches twice and fails as ambiguous.
 */
const NOT_LIVE_REGION = { ignore: '[role="status"], script, style' } as const

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
  test('a roll announces the result and marks exactly one row selected', () => {
    queued = [7]
    render(<RollTable table={RANGE_TABLE} showCommand tableName="Core Mechanic" />)

    // Before the roll: nothing announced, nothing selected.
    expect(announcement()).toBe('')
    expect(document.querySelectorAll('[aria-selected="true"]')).toHaveLength(0)

    rollAndReveal()

    // 7 falls in the 2-10 band, so that is the row that must light up.
    expect(announcement()).toBe('Rolled 2-10: Tough Choice - it works, but')
    const selected = document.querySelectorAll('[aria-selected="true"]')
    expect(selected).toHaveLength(1)
    expect(selected[0]?.textContent).toContain('Tough Choice')
  })

  test('the result is reported to the consumer with its label folded in', () => {
    const reported: Array<[string, string]> = []
    queued = [20]
    render(
      <RollTable
        table={RANGE_TABLE}
        showCommand
        onRollResult={(text, key) => reported.push([text, key])}
      />
    )

    rollAndReveal()

    expect(reported).toEqual([['Nailed It: nothing goes wrong', '20']])
  })

  test('rerolling replaces the previous result rather than adding to it', () => {
    queued = [1, 20]
    render(<RollTable table={RANGE_TABLE} showCommand />)

    rollAndReveal()
    expect(announcement()).toContain('Cascade Failure')

    clickAction('Reroll')

    expect(announcement()).toBe('Rolled 20: Nailed It - nothing goes wrong')
    // The old row must have let go of its selection, not merely been joined.
    const selected = document.querySelectorAll('[aria-selected="true"]')
    expect(selected).toHaveLength(1)
    expect(selected[0]?.textContent).toContain('Nailed It')
    expect(screen.queryAllByText('Reroll')).toHaveLength(1)
  })

  test('clicking the selected row clears the result and silences the live region', () => {
    queued = [20]
    render(<RollTable table={RANGE_TABLE} showCommand />)
    rollAndReveal()

    const selected = document.querySelector('[aria-selected="true"]')
    if (!(selected instanceof HTMLElement)) throw new Error('expected a selected row')
    fireEvent.click(selected)

    expect(document.querySelectorAll('[aria-selected="true"]')).toHaveLength(0)
    expect(announcement()).toBe('')
    expect(screen.queryByText('Reroll')).toBeNull()
  })

  test('Enter on the selected row clears it too — the keyboard path is not a dead end', () => {
    queued = [20]
    render(<RollTable table={RANGE_TABLE} showCommand />)
    rollAndReveal()

    const selected = document.querySelector('[aria-selected="true"]')
    if (!(selected instanceof HTMLElement)) throw new Error('expected a selected row')
    expect(selected.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(selected, { key: 'Enter' })

    expect(document.querySelectorAll('[aria-selected="true"]')).toHaveLength(0)
    expect(announcement()).toBe('')
  })

  test('Copy puts the labelled result text on the clipboard', () => {
    queued = [20]
    render(<RollTable table={RANGE_TABLE} showCommand />)
    rollAndReveal()

    fireEvent.click(screen.getByLabelText('Copy result to clipboard'))

    expect(copied).toEqual(['Nailed It: nothing goes wrong'])
  })

  test('a flat 1-20 table resolves on the rolled number itself', () => {
    queued = [13]
    render(<RollTable table={FLAT_TABLE} showCommand />)

    rollAndReveal()

    expect(announcement()).toBe('Rolled 13: Outcome 13 - it happens 13')
  })

  test('`disabled` withholds the Roll button but keeps the table readable', () => {
    render(<RollTable table={RANGE_TABLE} showCommand tableName="Core Mechanic" disabled />)

    expect(screen.queryByLabelText(ROLL_BUTTON)).toBeNull()
    // Header band + the sr-only <caption> both name it.
    expect(screen.getAllByText('Core Mechanic')).toHaveLength(2)
    expect(screen.getByText(/it works, but/, NOT_LIVE_REGION)).toBeTruthy()
  })
})

describe('collapsible mode', () => {
  test('starts collapsed, and a roll reveals the result without opening the table', () => {
    queued = [20]
    render(<RollTable table={RANGE_TABLE} collapsible tableName="Core Mechanic" />)

    // Collapsed: header only, no rows.
    expect(screen.queryByText(/it works, but/, NOT_LIVE_REGION)).toBeNull()
    expect(screen.getByText('Show')).toBeTruthy()

    rollAndReveal()

    // The rolled row slides out; the other 3 rows stay hidden.
    expect(announcement()).toContain('Nailed It')
    expect(screen.getByText(/nothing goes wrong/, NOT_LIVE_REGION)).toBeTruthy()
    expect(screen.queryByText(/it works, but/, NOT_LIVE_REGION)).toBeNull()
    expect(screen.getByText('Show')).toBeTruthy()
  })

  test('Clear is offered only in the slide-out, and empties it', () => {
    queued = [20]
    render(<RollTable table={RANGE_TABLE} collapsible />)

    // No result yet: no action bar at all.
    expect(screen.queryByLabelText('Clear result')).toBeNull()

    rollAndReveal()
    expect(screen.getByLabelText('Clear result')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Clear result'))

    expect(announcement()).toBe('')
    expect(screen.queryByLabelText('Clear result')).toBeNull()
  })

  test('the expand toggle opens the full table and tracks aria-expanded', () => {
    render(<RollTable table={RANGE_TABLE} collapsible />)

    const toggle = screen.getByText('Show').closest('button')
    if (!toggle) throw new Error('expected an expand toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle)

    expect(screen.getByText(/it works, but/, NOT_LIVE_REGION)).toBeTruthy()
    expect(screen.getByText('Hide').closest('button')?.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('the title-as-picker trigger', () => {
  test('names the current table, reports its open state, and calls back', () => {
    const opened: number[] = []
    render(
      <RollTable
        table={RANGE_TABLE}
        showCommand
        tableName="Core Mechanic"
        titleSelect={{ onOpen: () => opened.push(1) }}
      />
    )

    const trigger = screen.getByLabelText('Choose a roll table (current: Core Mechanic)')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)
    expect(opened).toHaveLength(1)
  })

  test('`disabled` suppresses rolling but NOT choosing which table to read', () => {
    render(
      <RollTable
        table={RANGE_TABLE}
        showCommand
        tableName="Core Mechanic"
        disabled
        titleSelect={{ onOpen: () => undefined, open: true, ariaLabel: 'Pick a table' }}
      />
    )

    expect(screen.queryByLabelText(ROLL_BUTTON)).toBeNull()
    const trigger = screen.getByLabelText('Pick a table')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('the columns variant', () => {
  test('two rolls pick the column and the entry, and exactly that cell lights up', () => {
    // 9 lands in the 9-12 column; 3 picks entry 3 within it.
    queued = [9, 3]
    render(<RollTable table={COLUMNS_TABLE} showCommand tableName="NPC Generator" />)

    rollAndReveal()

    expect(announcement()).toBe('Column 9-12, Roll 3: 9-12 entry 3')
    const selected = document.querySelectorAll('[aria-selected="true"]')
    expect(selected).toHaveLength(1)
    expect(selected[0]?.textContent).toContain('9-12 entry 3')
  })

  test('the column is chosen by range, not by the raw number', () => {
    // 17..20 all share one column, so the boundary is the thing worth pinning.
    queued = [17, 1]
    render(<RollTable table={COLUMNS_TABLE} showCommand />)

    rollAndReveal()

    expect(announcement()).toBe('Column 17-20, Roll 1: 17-20 entry 1')
  })

  test('rerolling from the highlighted cell moves the highlight', () => {
    queued = [1, 1, 20, 20]
    render(<RollTable table={COLUMNS_TABLE} showCommand />)

    rollAndReveal()
    expect(announcement()).toBe('Column 1-4, Roll 1: 1-4 entry 1')

    clickAction('Reroll')

    expect(announcement()).toBe('Column 17-20, Roll 20: 17-20 entry 20')
    expect(document.querySelectorAll('[aria-selected="true"]')).toHaveLength(1)
  })

  test('clicking the highlighted cell clears it', () => {
    queued = [1, 1]
    render(<RollTable table={COLUMNS_TABLE} showCommand />)
    rollAndReveal()

    const selected = document.querySelector('[aria-selected="true"]')
    if (!(selected instanceof HTMLElement)) throw new Error('expected a selected cell')
    fireEvent.click(selected)

    expect(document.querySelectorAll('[aria-selected="true"]')).toHaveLength(0)
    expect(announcement()).toBe('')
  })

  test('every column renders all 20 of its entries', () => {
    render(<RollTable table={COLUMNS_TABLE} showCommand />)

    for (const col of COLUMN_KEYS) {
      expect(screen.getByText(`(${col.replace('-', ' - ')})`)).toBeTruthy()
      expect(screen.getByText(new RegExp(`${col} entry 20$`), NOT_LIVE_REGION)).toBeTruthy()
    }
    // 5 columns x 20 rows.
    expect(document.querySelectorAll('tbody td')).toHaveLength(100)
  })

  test('collapsed, a roll reveals only the rolled cell', () => {
    queued = [5, 6]
    render(<RollTable table={COLUMNS_TABLE} collapsible />)

    expect(screen.queryByText('5-8 entry 6', NOT_LIVE_REGION)).toBeNull()

    rollAndReveal()

    expect(announcement()).toBe('Column 5-8, Roll 6: 5-8 entry 6')
    expect(screen.getByText(/5-8 entry 6/, NOT_LIVE_REGION)).toBeTruthy()
    // Still collapsed: no full grid behind it.
    expect(document.querySelectorAll('tbody td')).toHaveLength(0)
  })
})
