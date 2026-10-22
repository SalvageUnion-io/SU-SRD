import { describe, expect, test } from 'bun:test'
import { ownerChipFor, UNASSIGNED_LABEL } from '../ownerChip'

/**
 * Owner chips (ADR-030 §6).
 *
 * The case that carries the most weight is the difference between *unassigned*
 * and *owned but unresolved*. Both have no name to show, and collapsing them
 * would tell a Mediator that a pilot is free to hand out when it already
 * belongs to somebody — a data-integrity error dressed as a label.
 */

const lookup = (viewerId: string | null, names: Array<[string, string]> = []) => ({
  viewerId,
  namesById: new Map(names),
})

describe('unassigned is a rendered state, not a blank', () => {
  test('null owner reads as Unassigned', () => {
    const chip = ownerChipFor(null, lookup('u1'))
    expect(chip.label).toBe(UNASSIGNED_LABEL)
    expect(chip.unassigned).toBe(true)
  })

  test('undefined owner reads the same way', () => {
    // A row written before ownership existed must not render an empty chip.
    expect(ownerChipFor(undefined, lookup('u1')).label).toBe(UNASSIGNED_LABEL)
  })

  test('the label is never empty', () => {
    for (const owner of [null, undefined, 'u2', 'unknown-id']) {
      expect(ownerChipFor(owner, lookup('u1', [['u2', 'Beefcake']])).label.length).toBeGreaterThan(
        0
      )
    }
  })
})

describe('owned-but-unresolved is not unassigned', () => {
  test('an owner with no known name still reads as owned', () => {
    const chip = ownerChipFor('u-nobody-knows', lookup('u1'))
    // The important assertion: NOT unassigned. Offering this to a Mediator as
    // assignable would hand out a pilot that already belongs to someone.
    expect(chip.unassigned).toBe(false)
    expect(chip.label).toBe('Crewmate')
  })

  test('a resolvable owner shows their display name', () => {
    const chip = ownerChipFor('u2', lookup('u1', [['u2', 'Beefcake']]))
    expect(chip.label).toBe('Beefcake')
    expect(chip.unassigned).toBe(false)
    expect(chip.mine).toBe(false)
  })
})

describe('your own entities', () => {
  test('read as You', () => {
    const chip = ownerChipFor('u1', lookup('u1', [['u1', 'Alex']]))
    expect(chip.label).toBe('You')
    expect(chip.mine).toBe(true)
  })

  test('a signed-out viewer owns nothing', () => {
    const chip = ownerChipFor('u1', lookup(null))
    expect(chip.mine).toBe(false)
  })
})
