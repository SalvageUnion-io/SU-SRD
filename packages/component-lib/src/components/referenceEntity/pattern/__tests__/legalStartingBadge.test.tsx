import { describe, it, expect, afterEach } from 'bun:test'
import { render, screen, cleanup, renderHook } from '@testing-library/react'
import type { SURefEntity } from 'salvageunion-reference'
import { useChassisPatternConfig } from '../useChassisPatternConfig'
import type { PatternOverrideData } from '../../referenceEntityTypes'

/**
 * "Legal Starting Pattern" is an explicit data tag on a pattern (`legalStarting`),
 * set only where the source book calls it out. The badge must be driven purely by
 * that field — never computed from tech level or salvage value. Previously it was
 * derived from an SV-budget check, so untagged patterns (e.g. every Gopher pattern)
 * were wrongly badged.
 */
describe('useChassisPatternConfig legal starting badge', () => {
  afterEach(cleanup)

  // Synthetic chassis: one pattern explicitly tagged, one not. Resolution is by
  // pattern name against this chassis's own patterns, so the dataset is irrelevant.
  const chassis = {
    id: 'test-chassis',
    name: 'Testudo',
    techLevel: 1,
    salvageValue: 4,
    patterns: [
      { name: 'Tagged Pattern', legalStarting: true, systems: [], modules: [] },
      { name: 'Untagged Pattern', systems: [], modules: [] },
    ],
  } as unknown as SURefEntity

  const override = (name: string): PatternOverrideData => ({ name, systems: [], modules: [] })

  const badgePresent = (patternName: string): boolean => {
    const { result } = renderHook(() =>
      useChassisPatternConfig(chassis, override(patternName), false)
    )
    render(<div>{result.current?.subtitleExtra}</div>)
    return screen.queryByText('Legal Starting Pattern') !== null
  }

  it('shows the badge when the resolved pattern is tagged legalStarting', () => {
    expect(badgePresent('Tagged Pattern')).toBe(true)
  })

  it('hides the badge when the pattern carries no legalStarting tag', () => {
    expect(badgePresent('Untagged Pattern')).toBe(false)
  })
})
