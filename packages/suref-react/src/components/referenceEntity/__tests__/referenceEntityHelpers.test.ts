import { describe, it, expect } from 'bun:test'
import {
  calculateBackgroundColor,
  borderColorFromHeaderBg,
  accentSurface,
} from '../referenceEntityHelpers'

describe('calculateBackgroundColor', () => {
  const techLevelColors: Record<number, string> = {
    1: 'bg-su-orange',
    2: 'bg-su-orange',
    3: 'bg-su-orange-dark',
  }

  it('should return bg-su-grey-dark for guides schema with no headerColor', () => {
    const result = calculateBackgroundColor(
      'guides',
      '',
      undefined,
      {
        id: 'test',
        name: 'Test',
        source: 'Salvage Union Workshop Manual',
        page: 1,
        indexable: true,
        blackMarket: false,
      },
      techLevelColors
    )
    expect(result).toBe('bg-su-grey-dark')
  })

  it('should return headerColor for guides schema when provided', () => {
    const result = calculateBackgroundColor(
      'guides',
      'bg-su-pink',
      undefined,
      {
        id: 'test',
        name: 'Test',
        source: 'Salvage Union Workshop Manual',
        page: 1,
        indexable: true,
        blackMarket: false,
      },
      techLevelColors
    )
    expect(result).toBe('bg-su-pink')
  })

  it('should return bg-su-grey-dark for black market items', () => {
    const result = calculateBackgroundColor(
      'systems',
      '',
      1,
      {
        id: 'test',
        name: 'Test',
        source: 'Salvage Union Workshop Manual',
        page: 1,
        indexable: true,
        blackMarket: true,
      },
      techLevelColors
    )
    expect(result).toBe('bg-su-grey-dark')
  })

  it('should return bg-su-green for chassis schema', () => {
    const result = calculateBackgroundColor(
      'chassis',
      '',
      1,
      {
        id: 'test',
        name: 'Test',
        source: 'Salvage Union Workshop Manual',
        page: 1,
        indexable: true,
        blackMarket: false,
      },
      techLevelColors
    )
    expect(result).toBe('bg-su-green')
  })
})

describe('borderColorFromHeaderBg', () => {
  it('should return headerBgColor when provided', () => {
    expect(borderColorFromHeaderBg('bg-su-orange', '#D46A30')).toBe('#D46A30')
  })

  it('should derive CSS var from headerBg when headerBgColor is not provided', () => {
    expect(borderColorFromHeaderBg('bg-su-orange')).toBe('var(--color-su-orange)')
  })

  it('should return undefined when headerBg is falsy and no headerBgColor', () => {
    expect(borderColorFromHeaderBg('')).toBeUndefined()
    expect(borderColorFromHeaderBg(undefined)).toBeUndefined()
  })

  it('should prefer headerBgColor over headerBg derivation', () => {
    expect(borderColorFromHeaderBg('bg-su-orange', '#FF0000')).toBe('#FF0000')
  })
})

describe('accentSurface', () => {
  it('should fall back to bg-su-white with no inline style when headerBg is undefined', () => {
    expect(accentSurface(undefined, undefined)).toEqual({
      className: 'bg-su-white',
      style: undefined,
    })
  })

  it('should use the passed bg class with no inline style', () => {
    expect(accentSurface('bg-su-green', undefined)).toEqual({
      className: 'bg-su-green',
      style: undefined,
    })
  })

  it('should emit an inline backgroundColor when headerBgColor is truthy', () => {
    expect(accentSurface('bg-su-green', '#D46A30')).toEqual({
      className: 'bg-su-green',
      style: { backgroundColor: '#D46A30' },
    })
  })
})
