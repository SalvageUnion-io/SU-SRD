/**
 * `PlayTables` for the Mediator: an encounter table's rolled row lists its
 * roster (Workshop Manual p.270), and one press fields it on the Opposition
 * (`onField`). A player's Tables (no `onField`) list no roster.
 *
 * **The die.** `lib/dice` is replaced with the real module plus a
 * `dieForTable` serving a chosen d20, as `PlayRollTable.test.tsx` does;
 * `mock.module` is process-global, hence the capture-before-mock and the
 * `afterAll` restore.
 */
import { afterAll, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { RosterLine } from '../mediator/encounterRoster.model'

/** The d20 every roll lands on: Arid Steppes Encounters 16-19, the traders. */
const TRADERS = 17

const realDice = { ...(await import('../../lib/dice')) }

mock.module('../../lib/dice', () => ({
  ...realDice,
  rollD20: () => TRADERS,
  dieForTable: async () => () => TRADERS,
}))

const { PlayTables } = await import('../PlayTables')

afterAll(async () => {
  mock.module('../../lib/dice', () => realDice)
  const { rollD20 } = await import('../../lib/dice')
  const total = rollD20()
  if (!Number.isInteger(total) || total < 1 || total > 20) {
    throw new Error(`lib/dice was not restored: rollD20() gave ${total}`)
  }
})

const TABLE = 'Arid Steppes Encounters'

async function rollTraders(onField?: (lines: readonly RosterLine[]) => Promise<number>) {
  render(
    <PlayTables
      downtime={false}
      solo={false}
      post={false}
      onPostChange={() => {}}
      binding={null}
      onField={onField}
    />
  )
  fireEvent.change(screen.getByRole('searchbox', { name: 'Roll a table' }), {
    target: { value: 'Arid Steppes' },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(TABLE) }))
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^Roll the (die|dice) on / }))
  })
}

describe('an encounter table’s rolled roster', () => {
  test('lists the row’s opposition, and Add fields it on the Opposition', async () => {
    const fielded: (readonly RosterLine[])[] = []
    await rollTraders(async (lines) => {
      fielded.push(lines)
      return 5
    })
    const roster = within(screen.getByRole('region', { name: 'The rolled opposition' }))
    expect(roster.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '3 × Hauler Pattern Mule',
      '2 × Opus Pattern Gopher',
    ])
    await act(async () => {
      fireEvent.click(roster.getByRole('button', { name: 'Add to the Opposition' }))
    })
    expect(fielded).toHaveLength(1)
    expect(roster.getByText('5 added to the Opposition.')).toBeTruthy()
  })

  test('a failed field leaves the press to try again', async () => {
    await rollTraders(async () => {
      throw new Error('offline')
    })
    const roster = within(screen.getByRole('region', { name: 'The rolled opposition' }))
    await act(async () => {
      fireEvent.click(roster.getByRole('button', { name: 'Add to the Opposition' }))
    })
    expect(roster.getByRole('button', { name: 'Add to the Opposition' })).toBeTruthy()
  })

  test('a player’s Tables list no roster', async () => {
    await rollTraders()
    expect(screen.queryByRole('region', { name: 'The rolled opposition' })).toBeNull()
  })
})
