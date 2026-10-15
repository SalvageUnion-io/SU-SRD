import { describe, expect, it } from 'bun:test'
import { accentDeepColor } from '../referenceEntityHelpers'

describe('accentDeepColor', () => {
  it('mixes the tone 60% toward black', () => {
    expect(accentDeepColor('var(--color-pilot)')).toBe(
      'color-mix(in srgb, var(--color-pilot) 60%, black)'
    )
  })

  it('returns undefined without a tone so callers can fall back', () => {
    expect(accentDeepColor('')).toBeUndefined()
    expect(accentDeepColor(undefined)).toBeUndefined()
  })
})
