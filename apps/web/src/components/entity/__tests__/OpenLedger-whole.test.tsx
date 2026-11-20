/**
 * OpenLedger's `whole`: a reference Page shows its whole self (R43, R44), so
 * every row's rules stand open under it and no row draws an opener.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { OpenColumn, OpenRow } from '../../index'
import { OpenLedger } from '../../index'

const COLUMNS: OpenColumn[] = [{ key: 'slots', label: 'Slots' }]
const ROWS: OpenRow[] = [
  { id: 'a', name: 'Railgun', cells: [2], detail: <p>Railgun rules</p> },
  { id: 'b', name: 'Firewall', cells: [1], detail: <p>Firewall rules</p> },
]

describe('OpenLedger whole', () => {
  test('every row stands open, with no opener', () => {
    render(
      <OpenLedger title="Systems" whole columns={COLUMNS} groups={[{ key: 'g', rows: ROWS }]} />
    )
    expect(screen.getByText('Railgun rules')).toBeTruthy()
    expect(screen.getByText('Firewall rules')).toBeTruthy()
    expect(document.querySelectorAll('[aria-expanded]')).toHaveLength(0)
  })

  test('without it, a row keeps its rules under an opener', () => {
    render(<OpenLedger title="Systems" columns={COLUMNS} groups={[{ key: 'g', rows: ROWS }]} />)
    expect(screen.queryByText('Railgun rules')).toBeNull()
    expect(document.querySelectorAll('[aria-expanded="false"]')).toHaveLength(2)
  })
})
