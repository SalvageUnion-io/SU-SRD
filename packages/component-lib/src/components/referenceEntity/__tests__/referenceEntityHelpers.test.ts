import { describe, it, test, expect } from 'bun:test'
import {
  calculateBackgroundColor,
  borderColorFromHeaderBg,
  accentSurface,
  bandSurface,
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

describe('bandSurface — the header band fill', () => {
  test('a toned band paints the DEEP mix, not the base tone', () => {
    // Paper-white titles sit on this band, and the BASE tones could not carry
    // them: 2.41:1 on pilot, 1.69:1 on game, against a 4.5:1 AA floor. The fix
    // is the band, not the white — contrast against a light ground only
    // improves as the text darkens, so there is no "safer white" to reach for.
    const band = bandSurface('bg-mech', undefined)
    expect(band.style?.backgroundColor).toBe('color-mix(in srgb, var(--color-mech) 65%, black)')
  })

  test('a raw colour override is darkened the same way', () => {
    const band = bandSurface(undefined, '#ce5898')
    expect(band.style?.backgroundColor).toBe('color-mix(in srgb, #ce5898 65%, black)')
  })

  test('an UNTONED band is left alone', () => {
    // There is no base colour to darken here; the band is paper and its title
    // is ink. Darkening nothing would paint a black band under black text.
    const band = bandSurface(undefined, undefined)
    expect(band.className).toBe('bg-paper')
    expect(band.style).toBeUndefined()
  })
})

describe('bandSurface — the ink-title opt-out', () => {
  test('deep: false leaves the band at its base tone', () => {
    // A damaged / destroyed / ghosted card keeps an INK title on a light grey
    // band. Darkening that band measures 2.40:1 against 4.87:1 undarkened — so
    // the contrast fix, applied blindly, would have broken the one state it was
    // most important not to break. `ReferenceEntityCard` passes
    // `bandDeep={!(isDown || isGhosted)}`.
    const grey = 'color-mix(in srgb, var(--color-ink) 50%, var(--color-paper))'
    const band = bandSurface(undefined, grey, false)
    expect(band.style?.backgroundColor).toBe(grey)
  })

  test('deep defaults to true, so an ordinary card still darkens', () => {
    expect(bandSurface('bg-pilot', undefined).style?.backgroundColor).toBe(
      'color-mix(in srgb, var(--color-pilot) 65%, black)'
    )
  })
})
