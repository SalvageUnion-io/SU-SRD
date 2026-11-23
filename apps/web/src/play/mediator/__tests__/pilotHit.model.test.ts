import { describe, expect, test } from 'bun:test'
import type { TrayNpc } from '../opposition.model'
import { hitLandsOn, newestHit, pilotHitOf, weaponDamage } from '../pilotHit.model'

/** r7 C5 (LG7-09): a Pilot's hit carries its damage to the Mediator. */
const TWO_HP = () => ({ damageType: 'HP' as const, amount: 2 })
const roll = (description: string, over: Record<string, unknown> = {}) => ({
  _id: 'r-1',
  ts: 10,
  description,
  actorName: 'Sam',
  source: 'play',
  ...over,
})

describe('a Pilot’s hit (r7 C5)', () => {
  test('a weapon’s landed roll carries who hit and the weapon’s damage', () => {
    expect(pilotHitOf(roll('Hotdog · Improvised Melee Weapon · 11 · Success'), TWO_HP)).toEqual({
      rollId: 'r-1',
      who: 'Hotdog',
      weapon: 'Improvised Melee Weapon',
      damage: { damageType: 'HP', amount: 2 },
    })
  })

  test('who is read from the end, so a callsign and name both stand', () => {
    expect(pilotHitOf(roll('GHOST · Mara Voss · Red Laser · 20 · Nailed It'), TWO_HP)?.who).toBe(
      'GHOST'
    )
  })

  test('a miss, the Mediator’s own roll and a line with no weapon carry nothing', () => {
    expect(pilotHitOf(roll('Hotdog · Knife · 4 · Failure'), TWO_HP)).toBeNull()
    expect(pilotHitOf(roll('Raider · Knife · 14 · Success', { veiled: true }), TWO_HP)).toBeNull()
    expect(pilotHitOf(roll('Mags · Core Mechanic · 20 · Nailed it'), () => null)).toBeNull()
  })

  test('only the newest roll, and never one already applied', () => {
    const older = roll('Hotdog · Knife · 14 · Success', { _id: 'old', ts: 1 })
    const newer = roll('Mags · Core Mechanic · 12 · Success', { _id: 'new', ts: 2 })
    expect(
      newestHit([older, newer], new Set(), (w) => (w === 'Knife' ? TWO_HP() : null))
    ).toBeNull()
    expect(newestHit([older], new Set(['old']), TWO_HP)).toBeNull()
    expect(newestHit([older], new Set(), TWO_HP)?.rollId).toBe('old')
  })

  test('the reference gives a weapon’s damage by its name', () => {
    expect(weaponDamage('Improvised Melee Weapon')).toEqual({ damageType: 'HP', amount: 2 })
    expect(weaponDamage('Red Laser')).toEqual({ damageType: 'SP', amount: 3 })
    expect(weaponDamage('No Such Weapon')).toBeNull()
  })

  test('it lands on a standing unit whose stat takes it', () => {
    const hit = { rollId: 'r', who: 'Hotdog', weapon: 'Knife', damage: TWO_HP() }
    const npc = { down: false, maxHp: 5, statKind: 'hp' } as TrayNpc
    expect(hitLandsOn(hit, npc)).toBe(true)
    expect(hitLandsOn(hit, { ...npc, statKind: 'sp' })).toBe(false)
    expect(hitLandsOn(hit, { ...npc, down: true })).toBe(false)
  })
})
