import { describe, expect, test } from 'bun:test'
import { ownerChipFor, UNCLAIMED_LABEL, viewerMayEdit } from '../ownerChip'

/**
 * Owner chips (D32).
 *
 * The case that carries the most weight is the difference between *unclaimed*
 * and *owned but unresolved*. Both have no name to show, and collapsing them
 * would tell a Mediator that a pilot is free to hand out when it already
 * belongs to somebody — a data-integrity error dressed as a label.
 */

const lookup = (viewerId: string | null, names: Array<[string, string]> = []) => ({
  viewerId,
  namesById: new Map(names),
})

describe('unclaimed is a rendered state, not a blank', () => {
  test('null owner reads as Unclaimed', () => {
    const chip = ownerChipFor(null, lookup('u1'))
    expect(chip.label).toBe(UNCLAIMED_LABEL)
    expect(chip.unclaimed).toBe(true)
  })

  test('undefined owner reads the same way', () => {
    // A row written before ownership existed must not render an empty chip.
    expect(ownerChipFor(undefined, lookup('u1')).label).toBe(UNCLAIMED_LABEL)
  })

  test('the label is never empty', () => {
    for (const owner of [null, undefined, 'u2', 'unknown-id']) {
      expect(ownerChipFor(owner, lookup('u1', [['u2', 'Beefcake']])).label.length).toBeGreaterThan(
        0
      )
    }
  })
})

describe('owned-but-unresolved is not unclaimed', () => {
  test('an owner with no known name still reads as owned', () => {
    const chip = ownerChipFor('u-nobody-knows', lookup('u1'))
    // The important assertion: NOT unclaimed. Offering this to a Mediator as
    // assignable would hand out a pilot that already belongs to someone.
    expect(chip.unclaimed).toBe(false)
    expect(chip.label).toBe('Crewmate')
  })

  test('a resolvable owner shows their display name', () => {
    const chip = ownerChipFor('u2', lookup('u1', [['u2', 'Beefcake']]))
    expect(chip.label).toBe('Beefcake')
    expect(chip.unclaimed).toBe(false)
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

describe('viewerMayEdit mirrors the server rule', () => {
  test('the owner may edit', () => {
    expect(viewerMayEdit('u1', 'u1')).toBe(true)
  })

  test('a crewmate may not — a Mediator proposes instead', () => {
    expect(viewerMayEdit('u2', 'u1')).toBe(false)
  })

  test('an unclaimed entity is not editable until assigned', () => {
    // Otherwise a pre-gen could be quietly taken by editing it, bypassing the
    // assignment act the Change Log records.
    expect(viewerMayEdit(null, 'u1')).toBe(false)
    expect(viewerMayEdit(undefined, 'u1')).toBe(false)
  })

  test('a signed-out viewer may not edit anything in a game', () => {
    expect(viewerMayEdit('u1', null)).toBe(false)
  })
})
