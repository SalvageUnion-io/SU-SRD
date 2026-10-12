import { describe, expect, it } from 'bun:test'
import { accentSurface, borderColorFromHeaderBg } from '../referenceEntityHelpers'

describe('borderColorFromHeaderBg', () => {
  it('should return headerBgColor when provided', () => {
    expect(borderColorFromHeaderBg('bg-pilot', '#D46A30')).toBe('#D46A30')
  })

  it('should derive CSS var from headerBg when headerBgColor is not provided', () => {
    expect(borderColorFromHeaderBg('bg-pilot')).toBe('var(--color-pilot)')
  })

  it('should return undefined when headerBg is falsy and no headerBgColor', () => {
    expect(borderColorFromHeaderBg('')).toBeUndefined()
    expect(borderColorFromHeaderBg(undefined)).toBeUndefined()
  })

  it('should prefer headerBgColor over headerBg derivation', () => {
    expect(borderColorFromHeaderBg('bg-pilot', '#FF0000')).toBe('#FF0000')
  })
})

describe('accentSurface', () => {
  it('should fall back to bg-paper with no inline style when headerBg is undefined', () => {
    expect(accentSurface(undefined, undefined)).toEqual({
      className: 'bg-paper',
      style: undefined,
    })
  })

  it('should use the passed bg class with no inline style', () => {
    expect(accentSurface('bg-mech', undefined)).toEqual({
      className: 'bg-mech',
      style: undefined,
    })
  })

  it('should emit an inline backgroundColor when headerBgColor is truthy', () => {
    expect(accentSurface('bg-mech', '#D46A30')).toEqual({
      className: 'bg-mech',
      style: { backgroundColor: '#D46A30' },
    })
  })
})
