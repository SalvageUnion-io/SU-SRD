import { describe, expect, test } from 'bun:test'
import { makeScrapLot, makeUnitLot } from '../../schemas/cargoLot'
import {
  clampProposalValue,
  fieldLabel,
  normalizeReason,
  PROPOSAL_REASON_MAX,
  proposalTargets,
  proposalValueText,
} from '../proposals'

describe('what a proposal asks, as its line reads it', () => {
  test('a number reads as itself', () => {
    expect(proposalValueText(7)).toBe('7')
  })

  test('a bulk lot keeps its quantity (r8 B2)', () => {
    expect(proposalValueText([makeScrapLot(1, 3)])).toBe('+ 3 Tech 1 Scrap')
  })

  test('a whole unit reads by its name alone', () => {
    expect(proposalValueText([makeUnitLot('Mule (Damaged)'), makeScrapLot(2, 1)])).toBe(
      '+ Mule (Damaged), 1 Tech 2 Scrap'
    )
  })
})

describe('a proposal field, reason and value', () => {
  test('a field reads by its label; an unknown one as itself', () => {
    expect(fieldLabel('currentHP')).toBe('HP')
    expect(fieldLabel('cargoLots')).toBe('Cargo')
    expect(fieldLabel('odd')).toBe('odd')
  })

  test('no value reads as a dash, and a nameless lot as a question mark', () => {
    expect(proposalValueText(null)).toBe('—')
    expect(proposalValueText([{}])).toBe('+ ?')
  })

  test('a reason is trimmed, dropped when blank, and refused past the cap', () => {
    expect(normalizeReason('  hit  ')).toBe('hit')
    expect(normalizeReason('   ')).toBeUndefined()
    expect(normalizeReason(undefined)).toBeUndefined()
    expect(() => normalizeReason('x'.repeat(PROPOSAL_REASON_MAX + 1))).toThrow(RangeError)
  })

  test('a value is a whole number from 0 to the maximum', () => {
    expect(clampProposalValue(' ', 5)).toBeNull()
    expect(clampProposalValue('abc', 5)).toBeNull()
    expect(clampProposalValue('3.6', 5)).toBe(4)
    expect(clampProposalValue('9', 5)).toBe(5)
    expect(clampProposalValue('-2', null)).toBe(0)
  })
})

describe('what a proposal can be aimed at', () => {
  const pilot = (over: object) => ({
    _id: 'p1',
    linkId: 'l1',
    ownerId: 'u1',
    name: 'Pickle',
    mechId: 'm1',
    currentHP: 6,
    maxHP: 10,
    currentAP: 2,
    maxAP: 5,
    ...over,
  })
  const mech = (over: object) => ({
    _id: 'm1',
    linkId: 'm1',
    ownerId: 'u1',
    name: 'Spectrum',
    currentSP: 4,
    maxSP: 8,
    currentEP: 3,
    maxEP: 6,
    currentHeat: 1,
    maxHeat: 9,
    ...over,
  })

  test('no crew, no targets', () => {
    expect(proposalTargets(null)).toEqual([])
  })

  test('pilots first, a mech named by its pilot, the unowned left out', () => {
    const targets = proposalTargets({
      pilots: [pilot({}), pilot({ _id: 'p2', ownerId: null, mechId: null })],
      mechs: [mech({}), mech({ _id: 'm2', linkId: null, name: 'Rig' }), mech({ ownerId: null })],
    })
    expect(targets.map((t) => [t.kind, t.label, t.pilotLinkId])).toEqual([
      ['pilot', 'Pickle', 'l1'],
      ['mech', "Pickle's Spectrum", 'l1'],
      ['mech', 'Rig', null],
    ])
    expect(targets[0]?.readings.currentHP).toEqual({ current: 6, max: 10 })
    expect(targets[1]?.readings.currentHeat).toEqual({ current: 1, max: 9 })
  })
})
