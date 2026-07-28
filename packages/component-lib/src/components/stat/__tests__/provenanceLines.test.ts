/**
 * linesFromBreakdown — turning a numeric StatBreakdown into a labelled ledger
 * (ADR-029).
 */

import { describe, expect, test } from 'bun:test'
import type { StatBreakdown } from 'salvageunion-reference/rules'

import { linesFromBreakdown, summarizeBreakdown } from '../provenanceLines'

function parts(over: Partial<StatBreakdown> = {}): StatBreakdown {
  const base = { base: 10, installed: 0, adjustment: 0, derived: 10, total: 10, overridden: false }
  return { ...base, ...over }
}

describe('linesFromBreakdown', () => {
  test('a bare derivation is a single base line', () => {
    const lines = linesFromBreakdown(parts(), { base: 'Atlas chassis' })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ kind: 'base', label: 'Atlas chassis', amount: 10 })
  })

  test('omits zero-valued lines rather than rendering "+0" noise', () => {
    const lines = linesFromBreakdown(parts(), { base: 'Atlas chassis', installed: 'Installed' })
    expect(lines.map((l) => l.kind)).toEqual(['base'])
  })

  test('includes a negative contribution — an injury penalty is still a contribution', () => {
    const lines = linesFromBreakdown(parts({ installed: -2, derived: 8, total: 8 }), {
      base: 'Pilot',
      installed: 'Injuries',
    })
    expect(lines.map((l) => l.kind)).toEqual(['base', 'contribution'])
    expect(lines[1]).toMatchObject({ label: 'Injuries', amount: -2 })
  })

  test('a manual adjustment is its own labelled line, never folded into the base', () => {
    const lines = linesFromBreakdown(parts({ adjustment: 3, derived: 13, total: 13 }), {
      base: 'Atlas chassis',
    })
    expect(lines.map((l) => l.kind)).toEqual(['base', 'adjustment'])
    expect(lines[1]).toMatchObject({ label: 'Manual adjustment', amount: 3 })
  })

  test('an override APPENDS to the full derivation rather than replacing it', () => {
    const lines = linesFromBreakdown(
      parts({
        installed: 5,
        adjustment: 2,
        derived: 17,
        override: 25,
        total: 25,
        overridden: true,
      }),
      { base: 'Atlas chassis', installed: 'Installed systems' }
    )
    // every derived component is still listed, then the subtotal, then the pin
    expect(lines.map((l) => l.kind)).toEqual([
      'base',
      'contribution',
      'adjustment',
      'derived',
      'override',
    ])
    expect(lines.at(-2)).toMatchObject({ label: 'Derived', amount: 17 })
    expect(lines.at(-1)).toMatchObject({ label: 'Override', amount: 25 })
  })
})

describe('summarizeBreakdown', () => {
  test('reads as an equation for surfaces that can only take a string', () => {
    expect(
      summarizeBreakdown(parts({ installed: 4, derived: 14, total: 14 }), {
        base: 'Base',
        installed: 'Tech 3 scaling',
      })
    ).toBe('Base 10 +4 Tech 3 scaling = 14')
  })

  test('uses a true minus for a negative contribution', () => {
    expect(
      summarizeBreakdown(parts({ installed: -2, derived: 8, total: 8 }), {
        base: 'Pilot',
        installed: 'injuries',
      })
    ).toBe('Pilot 10 −2 injuries = 8')
  })

  test('names the pin without hiding the derivation it replaced', () => {
    const text = summarizeBreakdown(
      parts({ installed: 4, derived: 14, override: 20, total: 20, overridden: true }),
      { base: 'Base', installed: 'scaling' }
    )
    expect(text).toContain('= 14')
    expect(text).toContain('overridden to 20')
  })
})
