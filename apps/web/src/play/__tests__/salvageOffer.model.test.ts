/**
 * A crewmate changing a wreck's salvage pick (r7 D8): which parts they may
 * press, and whether what they picked is another answer than the Mediator's.
 */
import { describe, expect, test } from 'bun:test'
import type { SalvageOffer } from 'game-domain/games/proposals'
import { isChangedPick, offerChoices, togglePick } from '../salvageOffer.model'

const OFFER: SalvageOffer = {
  band: 'meat',
  parts: [
    { key: 'chassis', kind: 'chassis', name: 'Bobcat', techLevel: 1, salvageValue: 3 },
    { key: 'system:0', kind: 'system', name: 'Mining Rig', techLevel: 1, salvageValue: 1 },
  ],
  picked: ['system:0'],
}

describe('the crew’s pick of a wreck (r7 D8)', () => {
  test('a part joins the pick only while the roll allows it; a picked one can always go', () => {
    const choices = offerChoices(OFFER, ['system:0'])
    expect(choices.map((c) => [c.part.key, c.pressed, c.enabled])).toEqual([
      ['chassis', false, false],
      ['system:0', true, true],
    ])
    expect(offerChoices(OFFER, []).every((c) => c.enabled)).toBe(true)
  })

  test('pressing a part toggles it; the answer is changed only when the pick differs', () => {
    expect(togglePick(['system:0'], 'system:0')).toEqual([])
    expect(togglePick([], 'chassis')).toEqual(['chassis'])
    expect(isChangedPick(OFFER, ['system:0'])).toBe(false)
    expect(isChangedPick(OFFER, ['chassis'])).toBe(true)
  })

  test('each part reads its name, Tech Level and Slots', () => {
    const [chassis, rig] = offerChoices(OFFER, [])
    expect(chassis?.label).toBe('Bobcat · T1 · 3 Slots')
    expect(rig?.label).toBe('Mining Rig · T1 · 1 Slot')
  })
})
