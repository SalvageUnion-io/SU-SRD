import { describe, expect, it } from 'bun:test'
import { resolveDataValueForTechLevel } from './contentBlockHelpers.js'
import type { SURefObjectDataValue } from './types/index.js'

const damage: SURefObjectDataValue = {
  label: 'Damage',
  type: 'keyword',
  value: 2,
  unit: 'SP',
  perTechLevel: 1,
}

describe('resolveDataValueForTechLevel', () => {
  it('returns the base value unchanged at tech level 1 (or below)', () => {
    expect(resolveDataValueForTechLevel(damage, 1)).toEqual({ value: 2, scaled: false })
    expect(resolveDataValueForTechLevel(damage, 0)).toEqual({ value: 2, scaled: false })
  })

  it('adds perTechLevel for each tech level above the first', () => {
    // Custom Sniper Rifle: "+1 SP per Tech Level after the first".
    expect(resolveDataValueForTechLevel(damage, 3)).toEqual({ value: 4, scaled: true })
    expect(resolveDataValueForTechLevel(damage, 6)).toEqual({ value: 7, scaled: true })
  })

  it('returns the base value unchanged when no effective level is known', () => {
    expect(resolveDataValueForTechLevel(damage, undefined)).toEqual({ value: 2, scaled: false })
  })

  it('does not scale a value without perTechLevel', () => {
    const range: SURefObjectDataValue = { label: 'Range', value: 'Long' }
    expect(resolveDataValueForTechLevel(range, 5)).toEqual({ value: 'Long', scaled: false })
  })

  it('does not scale a non-numeric value even if perTechLevel is set', () => {
    const weird: SURefObjectDataValue = { label: 'X', value: 'n/a', perTechLevel: 2 }
    expect(resolveDataValueForTechLevel(weird, 4)).toEqual({ value: 'n/a', scaled: false })
  })

  it('resolves the real Custom Sniper Rifle damage from reference data', async () => {
    const { SalvageUnionReference } = await import('./index.js')
    await SalvageUnionReference.preload('all')
    const sniper = SalvageUnionReference.Equipment.all().find(
      (e) => e.name === 'Custom Sniper Rifle'
    )
    expect(sniper?.techLevel).toBe(1)
    const dv = sniper?.content
      ?.flatMap((b) => (Array.isArray(b.value) ? b.value : []))
      .find((v) => v.label === 'Damage')
    expect(dv?.perTechLevel).toBe(1)
    // The assertion above already failed the test if dv is missing — this
    // guard exists to narrow the type without an assertion.
    if (!dv) throw new Error('Custom Sniper Rifle Damage data value not found')
    expect(resolveDataValueForTechLevel(dv, 3)).toEqual({
      value: 4,
      scaled: true,
    })
  })
})
