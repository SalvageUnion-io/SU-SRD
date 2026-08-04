import { describe, it, expect } from 'bun:test'
import {
  calculateBackgroundColor,
  borderColorFromHeaderBg,
  accentSurface,
} from '../referenceEntityHelpers'

describe('calculateBackgroundColor', () => {
  const techLevelColors: Record<number, string> = {
    1: 'bg-pilot',
    2: 'bg-pilot',
    3: 'bg-rust',
  }

  it('should return bg-ink-2 for guides schema with no headerColor', () => {
    const result = calculateBackgroundColor(
      'guides',
      '',
      undefined,
      {
        id: 'test',
        name: 'Test',
        source: 'Salvage Union Workshop Manual',
        page: 1,
        blackMarket: false,
      },
      techLevelColors
    )
    expect(result).toBe('bg-ink-2')
  })

  it('should return headerColor for guides schema when provided', () => {
    const result = calculateBackgroundColor(
      'guides',
      'bg-crawler',
      undefined,
      {
        id: 'test',
        name: 'Test',
        source: 'Salvage Union Workshop Manual',
        page: 1,
        blackMarket: false,
      },
      techLevelColors
    )
    expect(result).toBe('bg-crawler')
  })

  it('should return bg-ink-2 for black market items', () => {
    const result = calculateBackgroundColor(
      'systems',
      '',
      1,
      {
        id: 'test',
        name: 'Test',
        source: 'Salvage Union Workshop Manual',
        page: 1,
        blackMarket: true,
      },
      techLevelColors
    )
    expect(result).toBe('bg-ink-2')
  })

  it('should return bg-mech for chassis schema', () => {
    const result = calculateBackgroundColor(
      'chassis',
      '',
      1,
      {
        id: 'test',
        name: 'Test',
        source: 'Salvage Union Workshop Manual',
        page: 1,
        blackMarket: false,
      },
      techLevelColors
    )
    expect(result).toBe('bg-mech')
  })
})

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
