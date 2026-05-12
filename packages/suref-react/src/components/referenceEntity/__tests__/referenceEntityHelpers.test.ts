import { describe, it, expect } from 'bun:test'
import {
  calculateBackgroundColor,
  borderColorFromHeaderBg,
  getSourceStyles,
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

describe('getSourceStyles', () => {
  it('should return scanline texture class for Mech Monday header', () => {
    const result = getSourceStyles('Mech Monday', false, 'header', true)
    expect(result.className).toBe('expansion-scanline-texture')
    expect(result.style).toEqual({})
  })

  it('should return scanline texture class for Mech Monday footer', () => {
    const result = getSourceStyles('Mech Monday', false, 'footer', true)
    expect(result.className).toBe('expansion-scanline-texture')
    expect(result.style).toEqual({})
  })

  it('should return empty when disabled', () => {
    const result = getSourceStyles('Mech Monday', true, 'header', true)
    expect(result.className).toBe('')
  })

  it('should return empty for footer when not expanded', () => {
    const result = getSourceStyles('Mech Monday', false, 'footer', false)
    expect(result.className).toBe('')
  })

  it('should return empty for undefined source', () => {
    const result = getSourceStyles(undefined, false, 'header', true)
    expect(result.className).toBe('')
  })

  it('should return beast texture for We Were Here First!', () => {
    expect(getSourceStyles('We Were Here First!', false, 'header', true).className).toBe(
      'expansion-beast-texture'
    )
    expect(getSourceStyles('We Were Here First!', false, 'footer', true).className).toBe(
      'expansion-beast-texture'
    )
  })

  it('should return rain texture for Rainmaker', () => {
    expect(getSourceStyles('Rainmaker', false, 'header', true).className).toBe(
      'expansion-rain-texture'
    )
    expect(getSourceStyles('Rainmaker', false, 'footer', true).className).toBe(
      'expansion-rain-texture'
    )
  })

  it('should return beveled border for False Flag', () => {
    const result = getSourceStyles('False Flag', false, 'header', true)
    expect(result.className).toBe('relative')
    expect(result.style.borderTop).toBeDefined()
    expect(result.style.boxShadow).toBeDefined()
  })

  it('should reuse scanline texture for Salvage Union Starter Set (placeholder styling)', () => {
    expect(getSourceStyles('Salvage Union Starter Set', false, 'header', true).className).toBe(
      'expansion-scanline-texture'
    )
    expect(getSourceStyles('Salvage Union Starter Set', false, 'footer', true).className).toBe(
      'expansion-scanline-texture'
    )
  })
})
