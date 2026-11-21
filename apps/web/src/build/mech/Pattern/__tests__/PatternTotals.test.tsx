/**
 * A saved pattern says what it uses and costs (r2 G4), and a count over its
 * chassis wears the one rule-breaking mark (hard rule R71): the mark the mech
 * sheet's figure wears, in words, and none on a loadout within its slots.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { countedLoadout, patternChassis } from '../../../../lib/patterns/patterns'
import { PatternLoadout } from '../../../../reference/PatternLoadout'
import { PatternTotals } from '../PatternTotals'

const MARK = '[data-rule-break]'
const within = { chassisRef: 'scrapper', systems: ['chainsaw'], modules: [] }
const past = {
  chassisRef: 'scrapper',
  systems: Array.from({ length: 12 }, () => 'mini-mortar'),
  modules: [],
}

describe('PatternTotals', () => {
  test('names the chassis, the slots filled of its own, and the Scrap', () => {
    render(<PatternTotals unit={within} />)
    const totals = screen.getByRole('group', { name: 'What it uses and costs' })
    expect(totals.textContent).toContain('Scrapper')
    expect(totals.textContent).toMatch(/System Slots\s*\d+\/\d+/)
    expect(totals.textContent).toMatch(/Module Slots\s*0\/\d+/)
    expect(totals.textContent).toMatch(/Scrap\s*\d+/)
    expect(totals.querySelector(MARK)).toBeNull()
  })

  test('R71: a count over its chassis wears the mark, once, in words', () => {
    render(<PatternTotals unit={past} />)
    const totals = screen.getByRole('group', { name: 'What it uses and costs' })
    expect(totals.querySelectorAll(MARK)).toHaveLength(1)
    expect(totals.querySelector(MARK)?.textContent).toMatch(/rule breaking/i)
  })

  test('a chassis the reference lacks has nothing to total', () => {
    const { container } = render(
      <PatternTotals unit={{ chassisRef: 'no-such-chassis', systems: [], modules: [] }} />
    )
    expect(container.textContent).toBe('')
  })
})

describe("a saved pattern's loadout Ledger", () => {
  test('counts copies on one line, and marks its total where the loadout is over', () => {
    const chassis = patternChassis(past)
    if (!chassis) throw new Error('no scrapper')
    const { container } = render(
      <PatternLoadout
        chassis={chassis}
        pattern={countedLoadout({ ...past, name: 'Mortar Wall' })}
      />
    )
    expect(container.textContent).toContain('Mini Mortar ×12')
    expect(container.querySelectorAll(`tfoot ${MARK}`)).toHaveLength(1)
  })
})
