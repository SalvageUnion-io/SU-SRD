/**
 * Claim detection (ADR-029) — shared by the parity audit and the entity card.
 *
 * The timing test is not incidental. These patterns began life in a build-time
 * tool over fixed data; C4 moved them into the RENDER path, where they run on
 * every paragraph and content-controlled whitespace becomes a denial-of-service
 * surface. CodeQL flagged the original as `js/polynomial-redos`, correctly.
 */

import { describe, expect, it } from 'bun:test'

import { statesMechanicalChange } from './rulesBearing.js'

describe('statesMechanicalChange', () => {
  it('detects a cap claim', () => {
    expect(statesMechanicalChange("This System increases your Mech's Max SP by 5.")).toBe('cap')
    expect(statesMechanicalChange('A Cargo Pod increases the Cargo Capacity of a Mech by 1.')).toBe(
      'cap'
    )
    expect(statesMechanicalChange('Your Pilot gains a Module Slot.')).toBe('cap')
  })

  it('detects an effect claim', () => {
    expect(statesMechanicalChange('Your Mech gains the Fly Trait.')).toBe('effect')
    expect(statesMechanicalChange('deals an additional 2 SP damage')).toBe('effect')
  })

  it('ignores flavour text', () => {
    expect(statesMechanicalChange('Layered plates of highly resilient metals.')).toBeNull()
    expect(statesMechanicalChange(undefined)).toBeNull()
  })

  it('prefers the more specific cap claim when a sentence reads as both', () => {
    expect(
      statesMechanicalChange('Increases Max SP by 5 and deals an additional 1 SP damage.')
    ).toBe('cap')
  })

  it('is insensitive to whitespace shape — newlines and runs read the same', () => {
    expect(statesMechanicalChange("increases   your\n  Mech's\tMax SP by 5")).toBe('cap')
  })

  it('stays LINEAR on adversarial whitespace (js/polynomial-redos regression)', () => {
    // The exact shapes CodeQL named: 'add ' / 'extra ' plus many spaces. The old
    // patterns' adjacent \s+/\s* quantifiers backtracked polynomially here.
    for (const prefix of ['add ', 'extra ', 'increase your ', 'gains the ']) {
      const evil = prefix + ' '.repeat(50_000) + 'x'
      const started = performance.now()
      statesMechanicalChange(evil)
      expect(performance.now() - started).toBeLessThan(250)
    }
  })
})
