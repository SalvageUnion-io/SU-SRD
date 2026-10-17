import { describe, expect, it } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { RefChassis } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

/**
 * "Legal Starting Pattern" is an explicit data tag on a pattern (`legalStarting`),
 * set only where the source book calls it out. The label must be driven purely by
 * that field — never computed from tech level or salvage value: an SV-budget
 * check wrongly labels untagged patterns (e.g. every Gopher pattern).
 */
describe('the pattern card’s legal starting label', () => {
  const mule = SalvageUnionReference.Chassis.getByName('Mule') as RefChassis

  const labelPresent = (patternName: string): boolean => {
    const pattern = mule.patterns.find((p) => p.name === patternName)
    if (!pattern) throw new Error(`fixture missing: Mule pattern ${patternName}`)
    render(<ReferenceEntityCard data={mule} pattern={pattern} size="compact" />)
    return screen.queryByText('Legal Starting Pattern') !== null
  }

  it('shows the label when the pattern is tagged legalStarting (Hauler)', () => {
    expect(labelPresent('Hauler')).toBe(true)
  })

  it('hides the label when the pattern carries no legalStarting tag (Crusher)', () => {
    expect(labelPresent('Crusher')).toBe(false)
  })
})
