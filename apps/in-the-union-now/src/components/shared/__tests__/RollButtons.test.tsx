import { describe, test, expect } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { RollButtons } from '../RollInput'

describe('RollButtons', () => {
  // The Callsign Table is a `columns`-type roll table. The previous naive
  // roll implementation could not navigate columns tables and produced an
  // empty string, so the callsign roller appeared to do nothing.
  test('rolls a non-empty result for the columns-type Callsign Table', () => {
    const rolled: string[] = []
    render(<RollButtons rollTableName="Callsign Table" onChange={(v) => rolled.push(v)} />)

    fireEvent.click(screen.getByLabelText('Roll on Callsign Table table'))

    expect(rolled).toHaveLength(1)
    expect(rolled[0]!.length).toBeGreaterThan(0)
  })

  test('rolls a non-empty result for a standard d20 table', () => {
    const rolled: string[] = []
    render(<RollButtons rollTableName="Background" onChange={(v) => rolled.push(v)} />)

    fireEvent.click(screen.getByLabelText('Roll on Background table'))

    expect(rolled).toHaveLength(1)
    expect(rolled[0]!.length).toBeGreaterThan(0)
  })
})
