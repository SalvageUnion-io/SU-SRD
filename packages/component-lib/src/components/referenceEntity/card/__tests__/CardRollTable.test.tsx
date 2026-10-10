/**
 * The embedded roll table (board E4): one bar in every state, the result as a
 * readout whether or not the table is open, and the rolled row marked.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { CardRollTable } from '../CardRollTable'

const coreMechanic = () => {
  const table = SalvageUnionReference.RollTables.getByName('Core Mechanic')?.table
  if (!table) throw new Error('Core Mechanic fixture missing')
  return table
}

describe('CardRollTable', () => {
  test('collapsed: the bar alone — ROLL THE DIE, the name, Roll and the Table toggle', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="medium"
        collapsible
        disabled={false}
      />
    )
    expect(screen.getByText('Roll the Die:')).toBeTruthy()
    expect(screen.getByText('Core Mechanic')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Roll on this table' })).toBeTruthy()
    const toggle = screen.getByRole('button', { name: 'Show the Core Mechanic table' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  test('rolled while collapsed: the readout, without the table', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="medium"
        collapsible
        disabled={false}
        defaultRoll={14}
      />
    )
    expect(screen.getByText('14')).toBeTruthy()
    expect(screen.getByText('You rolled · lands on 11–19')).toBeTruthy()
    expect(screen.getByText('Success')).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
    expect(screen.getByRole('button', { name: 'Reroll on this table' })).toBeTruthy()
  })

  test('rolled and open: the matching row is marked, the same for every outcome', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="medium"
        collapsible={false}
        disabled={false}
        defaultRoll={14}
      />
    )
    const rows = screen.getAllByRole('listitem')
    expect(rows.length).toBe(5)
    const marked = rows.filter((row) => row.getAttribute('aria-current') === 'true')
    expect(marked).toHaveLength(1)
    expect(marked[0]?.textContent).toContain('Rolled 14')
  })

  test('rolling never needs the table open, and the toggle opens it', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="medium"
        collapsible
        disabled={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Roll on this table' }))
    expect(screen.getByText(/You rolled · lands on/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show the Core Mechanic table' }))
    expect(screen.getAllByRole('listitem').length).toBe(5)
  })

  test('a damaged host reads the table but cannot roll it', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="medium"
        collapsible={false}
        disabled
      />
    )
    expect(screen.queryByRole('button', { name: /on this table/ })).toBeNull()
    expect(screen.getAllByRole('listitem').length).toBe(5)
  })
})
