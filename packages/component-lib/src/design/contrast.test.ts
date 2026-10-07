import { describe, expect, test } from 'bun:test'
import type { SURefEnumSchemaName, SURefMetaEntity } from 'salvageunion-reference'
import { EntitySchemaNames, SalvageUnionReference } from 'salvageunion-reference'
import { resolveCardColors } from '../components/referenceEntity/card/cardChrome'
import type { DomainTone } from '../components/referenceEntity/card/entityCardTone'
import {
  resolveCardTone,
  resolveSchemaDomain,
} from '../components/referenceEntity/card/entityCardTone'
import {
  borderColorFromHeaderBg,
  onToneText,
} from '../components/referenceEntity/referenceEntityHelpers'
import type { Rgb } from './contrast'
import { contrastRatio, foregroundOn, resolveColor } from './contrast'
import { color } from './tokens'

/**
 * Card-band contrast guard.
 *
 * Every card band used to print paper ("solid tones read white") and the
 * footer printed it at 70%. axe measured 3.03:1 for a mech pattern's title and
 * 3.99:1 for a guide's footer, and against the whole palette paper failed on
 * TL1 (1.79:1), pilot (2.41:1) and mech (3.04:1) among others. Nothing caught
 * it, because nothing measured the bands: the scan only visits nine SRD pages.
 *
 * So this measures every band a card can actually wear — the tones are read
 * off the dataset through the card's own resolver, not listed by hand — in
 * each of the three states that repaint them (solid, ghosted under a host,
 * damaged grey), and asserts what WCAG 1.4.3 asks of the text printed there.
 */

const opaque = (css: string): Rgb => {
  const rgb = resolveColor(css)
  if (!rgb) throw new Error(`not an opaque colour: ${css}`)
  return rgb
}
const PAPER = opaque(color.paper)
const INK = opaque(color.ink)
const FOREGROUND = { 'text-paper': PAPER, 'text-ink': INK } as const

describe('resolveColor', () => {
  test('reads the colour syntaxes the bands are painted with', () => {
    expect(resolveColor('rgb(1, 2, 3)')).toEqual([1, 2, 3])
    expect(resolveColor('rgb(1 2 3)')).toEqual([1, 2, 3])
    expect(resolveColor('#ff8000')).toEqual([255, 128, 0])
    expect(resolveColor('black')).toEqual([0, 0, 0])
    expect(resolveColor('var(--color-tl-3)')).toEqual(opaque(color.tl3))
    expect(resolveColor('var(--su-color-tl-b)')).toEqual(opaque(color.tlB))
  })

  test('mixes in sRGB as `color-mix()` does, nested and with implied shares', () => {
    expect(resolveColor('color-mix(in srgb, white 50%, black)')).toEqual([127.5, 127.5, 127.5])
    expect(resolveColor('color-mix(in srgb, white, black 75%)')).toEqual([63.75, 63.75, 63.75])
    expect(resolveColor('color-mix(in srgb, white 60%, black 60%)')).toEqual([127.5, 127.5, 127.5])
    expect(
      resolveColor('color-mix(in srgb, color-mix(in srgb, white 50%, black) 50%, black)')
    ).toEqual([63.75, 63.75, 63.75])
  })

  test('refuses what it cannot know without the page', () => {
    // A translucent colour's paint depends on its ground; so does a mix whose
    // shares sum under 100%.
    expect(resolveColor('rgb(1 2 3 / 0.5)')).toBeUndefined()
    expect(resolveColor(color.paper70)).toBeUndefined()
    expect(resolveColor('color-mix(in srgb, white 20%, black 20%)')).toBeUndefined()
    expect(resolveColor('color-mix(in oklch, white 50%, black)')).toBeUndefined()
    expect(resolveColor('var(--color-not-a-token)')).toBeUndefined()
    expect(resolveColor('red')).toBeUndefined()
  })

  test('reads an alpha slash with or without spaces around it', () => {
    expect(resolveColor('rgb(1 2 3/0.5)')).toBeUndefined()
    expect(resolveColor('rgb(1 2 3 /0.5 )')).toBeUndefined()
    expect(resolveColor('rgb(1 2 3 )')).toEqual([1, 2, 3])
  })

  test('rejects a long run of spaces without backtracking (CodeQL js/polynomial-redos)', () => {
    const start = performance.now()
    // The old pattern took ~1.8 s on this input; the linear one well under 1 ms.
    expect(resolveColor(`rgb(1\t1\t1${' '.repeat(100_000)}`)).toBeUndefined()
    expect(performance.now() - start).toBeLessThan(500)
  })

  test('an unresolvable band keeps the caller’s fallback', () => {
    expect(foregroundOn(undefined)).toBe('paper')
    expect(foregroundOn('var(--color-tl-1)')).toBe('ink')
    expect(onToneText(undefined)).toBe('text-paper')
    expect(onToneText('red', 'text-ink')).toBe('text-ink')
    expect(onToneText('var(--color-tl-1)', 'text-paper')).toBe('text-ink')
  })
})

/** Every tone a card wears, read off the dataset by the card's own resolver. */
function everyCardTone(): Map<string, DomainTone> {
  const tones = new Map<string, DomainTone>()
  for (const schema of EntitySchemaNames) {
    if (!resolveSchemaDomain(schema)) continue
    const name = schema as SURefEnumSchemaName
    for (const entity of SalvageUnionReference.findAllIn(name, () => true)) {
      const tone = resolveCardTone(name, entity as SURefMetaEntity)
      tones.set(borderColorFromHeaderBg(tone.bg, tone.bgColor) ?? 'none', tone)
    }
  }
  return tones
}

type Band = { name: string; ground: Rgb | undefined; foreground: keyof typeof FOREGROUND }

/** Each band a card paints, per tone and state, with the foreground it chose. */
function everyBand(): { header: Band[]; deep: Band[] } {
  const header: Band[] = []
  const deep: Band[] = []
  for (const [base, tone] of everyCardTone()) {
    const states = {
      solid: { isDown: false, isGhosted: false },
      damaged: { isDown: true, isGhosted: false },
      // A nested action ghosts the tone of the card it hangs off.
      ghosted: { isDown: false, isGhosted: true },
    }
    for (const [state, flags] of Object.entries(states)) {
      const c = resolveCardColors({ tone, ...flags, hostTone: base })
      const headerCss = borderColorFromHeaderBg(c.headerBg, c.headerBgColor) ?? ''
      header.push({
        name: `${base} ${state} header`,
        ground: resolveColor(headerCss),
        foreground: c.onBandText,
      })
      deep.push({
        name: `${base} ${state} sub-header/footer`,
        ground: resolveColor(c.darkTone),
        foreground: c.onDarkText,
      })
    }
  }
  return { header, deep }
}

const ratio = (band: Band) => contrastRatio(band.ground ?? PAPER, FOREGROUND[band.foreground])

/**
 * Headers whose BEST foreground still misses 4.5:1. Neither ink nor paper
 * reaches it on these three book tones; fixing that is re-toning the palette
 * away from the printed book, which this guard does not do. They clear 3:1,
 * which the header's title — large text at every top-level card size — owes.
 * This list is exact: a tone that starts passing must be deleted from it.
 */
const HEADER_SHORTFALL = new Set([
  'var(--color-crawler) solid header',
  'var(--color-tl-3) solid header',
  'var(--color-tl-n) solid header',
])

describe('card band contrast', () => {
  const { header, deep } = everyBand()

  test('the guard found the palette', () => {
    // A resolver that stopped reading the dataset would pass everything below.
    expect(header.length).toBeGreaterThan(40)
  })

  test('every band resolves — none falls back to a guess', () => {
    const unresolved = [...header, ...deep].filter((b) => !b.ground).map((b) => b.name)
    expect(unresolved).toEqual([])
  })

  test('each band prints in whichever of ink and paper contrasts more', () => {
    const wrong = [...header, ...deep]
      .filter((b) => {
        const other = b.foreground === 'text-ink' ? PAPER : INK
        return contrastRatio(b.ground ?? PAPER, other) > ratio(b)
      })
      .map((b) => b.name)
    expect(wrong).toEqual([])
  })

  test('sub-header and footer text clears 4.5:1 on every tone', () => {
    const failures = deep
      .filter((b) => ratio(b) < 4.5)
      .map((b) => `${b.name}: ${ratio(b).toFixed(2)}`)
    expect(failures).toEqual([])
  })

  test('header text clears 4.5:1, bar the recorded shortfalls, which clear 3:1', () => {
    const below = header.filter((b) => ratio(b) < 4.5)
    expect(below.map((b) => b.name).sort()).toEqual([...HEADER_SHORTFALL].sort())
    const underLarge = below
      .filter((b) => ratio(b) < 3)
      .map((b) => `${b.name}: ${ratio(b).toFixed(2)}`)
    expect(underLarge).toEqual([])
  })
})
