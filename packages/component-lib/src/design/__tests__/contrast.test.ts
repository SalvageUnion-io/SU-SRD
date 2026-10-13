import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SURefEnumSchemaName, SURefMetaEntity } from 'salvageunion-reference'
import { EntitySchemaNames, SalvageUnionReference } from 'salvageunion-reference'
import { CHAPTER_BAND_COLOR } from '../../components/atoms/chapterBandColor'
import { rollBandColor } from '../../components/compositions/rollTableBands'
import { resolveCardColors } from '../../components/referenceEntity/card/cardChrome'
import type { DomainTone, TitleRung } from '../../components/referenceEntity/card/entityCardTone'
import {
  entityGuideToneColor,
  resolveCardTone,
  resolveSchemaDomain,
  titleSizeRung,
} from '../../components/referenceEntity/card/entityCardTone'
import { onTone, textBand } from '../../components/referenceEntity/referenceEntityHelpers'
import { readPackageStylesheet } from '../../styles/__tests__/packageStylesheet'
import type { Rgb } from '../contrast'
import {
  contrastRatio,
  foregroundOn,
  resolveColor,
  resolveColorOver,
  TEXT_CONTRAST,
} from '../contrast'
import { color, fontSize, weight } from '../tokens'

/**
 * Card-band contrast guard.
 *
 * Paper on every card band ("solid tones read white") fails: axe measured
 * 3.03:1 for a mech pattern's title and 3.99:1 for a guide's footer at 70%, and
 * against the whole palette paper fails on TL1 (1.79:1), pilot (2.41:1) and
 * mech (3.04:1) among others. The page scan cannot catch it: it visits only
 * nine SRD pages.
 *
 * So this measures every band a card can actually wear — the tones are read
 * off the dataset through the card's own resolver, not listed by hand — in
 * each state that repaints them (solid, damaged grey) and as the ink banner,
 * and asserts what WCAG 1.4.3 asks of the text printed there.
 */

const opaque = (css: string): Rgb => {
  const rgb = resolveColor(css)
  if (!rgb) throw new Error(`not an opaque colour: ${css}`)
  return rgb
}
const PAPER = opaque(color.paper)
const INK = opaque(color.ink)
const FOREGROUND = { paper: PAPER, ink: INK } as const

describe('resolveColor', () => {
  test('reads the colour syntaxes the bands are painted with', () => {
    expect(resolveColor('rgb(1, 2, 3)')).toEqual([1, 2, 3])
    expect(resolveColor('rgb(1 2 3)')).toEqual([1, 2, 3])
    expect(resolveColor('#ff8000')).toEqual([255, 128, 0])
    expect(resolveColor('black')).toEqual([0, 0, 0])
    expect(resolveColor('var(--color-tl-3)')).toEqual(opaque(color.tl3))
    expect(resolveColor('var(--color-tl-b)')).toEqual(opaque(color.tlB))
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
    expect(onTone(undefined)).toBe('paper')
    expect(onTone('red', 'ink')).toBe('ink')
    expect(onTone('var(--color-tl-1)', 'paper')).toBe('ink')
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
      tones.set(tone.bgColor ?? tone.bg ?? 'none', tone)
    }
  }
  return tones
}

type Band = { name: string; ground: Rgb | undefined; foreground: keyof typeof FOREGROUND }

/**
 * Each header band a card paints, per tone and state, with the foreground it
 * chose. The header is the only coloured band left: the "//" line and the
 * footer are ink on paper on every card (ruleset §5), so there is no deep
 * shade to measure any more. The ink banner is measured once per state —
 * it is the same band whatever the tone.
 */
function everyHeader(): Band[] {
  const bands: Band[] = []
  const measure = (name: string, tone: DomainTone, isDown: boolean, fill: 'tone' | 'ink') => {
    const c = resolveCardColors({ tone, isDown, fill })
    bands.push({ name, ground: resolveColor(c.bandColor ?? ''), foreground: c.onBand })
  }
  for (const [base, tone] of everyCardTone()) {
    measure(`${base} solid header`, tone, false, 'tone')
    measure(`${base} damaged header`, tone, true, 'tone')
  }
  const neutral: DomainTone = { domain: 'action', bg: undefined, bgColor: undefined }
  measure('ink banner', neutral, false, 'ink')
  measure('ink banner damaged', neutral, true, 'ink')
  return bands
}

const ratio = (band: Band) => contrastRatio(band.ground ?? PAPER, FOREGROUND[band.foreground])

/**
 * What a header owes is set by its TITLE SIZE, not by its band (WCAG 1.4.3):
 * large text — 24px, or 18.66px (14pt) bold — owes 3:1, anything smaller
 * 4.5:1. The title is set extrabold (`EntityCardHeader`), so the bold
 * threshold is the one that applies.
 *
 * Every tone can render at every size and depth, so each band owes what the
 * SMALLEST title it can carry owes: a small card's 17px title (and every
 * nested rung below it) is under 18.66px, so every band owes 4.5:1. There is
 * no per-band exemption: TL3 and Nanite once sat at 3.99:1 and 3.94:1 on the
 * reasoning that their titles were large at every size, which a small card
 * disproved, so they were retoned instead.
 */
const LARGE_TEXT_PX = 24
const LARGE_BOLD_TEXT_PX = 18.66
const TITLE_WEIGHT = weight.extrabold

const px = (size: string): number => {
  const m = size.match(/^([\d.]+)px$/)
  if (!m) throw new Error(`not a px size: ${size}`)
  return Number(m[1])
}

/** The ratio WCAG 1.4.3 asks of a title set at this rung. */
function owedByTitle(rung: TitleRung): number {
  const size = px(fontSize[rung])
  const large = size >= LARGE_TEXT_PX || (TITLE_WEIGHT >= weight.bold && size >= LARGE_BOLD_TEXT_PX)
  return large ? 3 : 4.5
}

/** Every rung a card title can be set at: each size, at each nesting depth. */
const TITLE_RUNGS: TitleRung[] = [
  ...new Set(
    (['large', 'medium', 'small'] as const).flatMap((size) =>
      [0, 1, 2, 3, 4, 5, 6].map((depth) => titleSizeRung(depth, size))
    )
  ),
]

describe('card band contrast', () => {
  const header = everyHeader()

  test('the guard found the palette', () => {
    // A resolver that stopped reading the dataset would pass everything below.
    expect(header.length).toBeGreaterThan(20)
  })

  test('every band resolves — none falls back to a guess', () => {
    const unresolved = header.filter((b) => !b.ground).map((b) => b.name)
    expect(unresolved).toEqual([])
  })

  test('each band prints in whichever of ink and paper contrasts more', () => {
    const wrong = header
      .filter((b) => {
        const other = b.foreground === 'ink' ? PAPER : INK
        return contrastRatio(b.ground ?? PAPER, other) > ratio(b)
      })
      .map((b) => b.name)
    expect(wrong).toEqual([])
  })

  test('the ink banner carries paper text far past 4.5:1', () => {
    const banner = header.find((b) => b.name === 'ink banner')
    expect(banner?.foreground).toBe('paper')
    expect(banner ? ratio(banner) : 0).toBeGreaterThan(10)
  })

  // E17: the chips sit on the band. A chip's two cells are ink and paper
  // plates, text on each the other (4.5:1 by construction); on the ink banner
  // its ink cell has no edge of its own, so `.su-chips--on-ink` keeps a paper
  // rule round every cell, and that rule owes 3:1 against the band (WCAG 1.4.11).
  test('a chip on the ink banner keeps a paper rule that clears 3:1 against it', () => {
    const css = readPackageStylesheet().replace(/\/\*[\s\S]*?\*\//g, '')
    const rule = css.match(/\.su-chips--on-ink \.su-stat-cell\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toContain('border-color: var(--color-paper)')
    expect(contrastRatio(INK, PAPER)).toBeGreaterThanOrEqual(TEXT_CONTRAST)
    for (const name of ['ink banner', 'ink banner damaged']) {
      const banner = header.find((b) => b.name === name)
      expect(banner?.ground).toBeDefined()
      expect(contrastRatio(banner?.ground ?? PAPER, PAPER)).toBeGreaterThanOrEqual(3)
    }
  })

  test('a small card’s title is under the large-text threshold, so owes 4.5:1', () => {
    expect(px(fontSize[titleSizeRung(0, 'small')])).toBeLessThan(LARGE_BOLD_TEXT_PX)
    expect(owedByTitle(titleSizeRung(0, 'small'))).toBe(4.5)
    expect(owedByTitle(titleSizeRung(0, 'large'))).toBe(3)
  })

  for (const rung of TITLE_RUNGS) {
    test(`header text clears what a ${fontSize[rung]} title owes on every band`, () => {
      const owed = owedByTitle(rung)
      const short = header
        .filter((b) => ratio(b) < owed)
        .map((b) => `${b.name}: ${ratio(b).toFixed(2)} < ${owed}`)
      expect(short).toEqual([])
    })
  }
})

/**
 * Ink on colour (ruleset §3.8, board 03 "Paper page. Legible bands").
 *
 * The brand refresh moved text on an ontology fill from paper to ink, and gave
 * the two bands that carry paper text values that can: pilot and mech fail
 * paper (2.4 and 3.0:1) and pass ink; crawler pink passes neither, so a crawler
 * band carrying paper text is `crawlerBand`; the Denizens navy carries paper.
 * Each pair is asserted at WCAG 1.4.3's 4.5:1 for body text — these bands
 * carry small caps, not only large titles — and `foregroundOn`, which every
 * card band reads, must pick the same foreground the ruleset names.
 */
describe('ink on colour — the refresh pairs', () => {
  const PAIRS = [
    { band: 'pilot', ground: color.pilot, text: 'ink' },
    { band: 'mech', ground: color.mech, text: 'ink' },
    { band: 'crawlerBand', ground: color.crawlerBand, text: 'paper' },
    { band: 'denizenBand', ground: color.denizenBand, text: 'paper' },
    // The Avatar fallback initial sits on pilot (Avatar.tsx).
    { band: 'avatar', ground: color.pilot, text: 'ink' },
    // The ability tiers' Row banners and tree tracks: Core is pilot (above),
    // Advanced and Hybrid the darker rust, Legendary purple.
    { band: 'tierAdvanced', ground: color.tierAdvanced, text: 'paper' },
    { band: 'tierLegendary', ground: color.tierLegendary, text: 'paper' },
  ] as const

  for (const { band, ground, text } of PAIRS) {
    test(`${text} on ${band} clears 4.5:1, and is the foreground the band picks`, () => {
      const fg = text === 'ink' ? INK : PAPER
      expect(contrastRatio(opaque(ground), fg)).toBeGreaterThanOrEqual(4.5)
      expect(foregroundOn(ground)).toBe(text)
    })
  }

  test('crawler pink carries neither foreground at 4.5:1 — hence the band', () => {
    // The reason `crawlerBand` exists. If a re-tone ever lets pink carry text,
    // the band is redundant and this says so.
    expect(contrastRatio(opaque(color.crawler), INK)).toBeLessThan(4.5)
    expect(contrastRatio(opaque(color.crawler), PAPER)).toBeLessThan(4.5)
  })

  test('a crawler header paints the crawler band and prints paper on it', () => {
    const crawler: DomainTone = {
      domain: 'crawler',
      bg: 'var(--color-crawler)',
      bgColor: undefined,
    }
    const c = resolveCardColors({ tone: crawler, isDown: false, fill: 'tone' })
    expect(c.bandColor).toBe('var(--color-crawler-band)')
    expect(c.onBand).toBe('paper')
    expect(onTone('var(--color-crawler)')).toBe('paper')
    expect(contrastRatio(opaque(color.crawlerBand), PAPER)).toBeGreaterThanOrEqual(4.5)
  })

  test('muted text clears 4.5:1 on paper and on every page ground', () => {
    for (const ground of [color.paper, color.wkBg, color.wkBg2, color.bandCream]) {
      expect(contrastRatio(opaque(color.wkMuted), opaque(ground))).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('the page ground is a paper one step below the card paper', () => {
    // Board 03: the ground is the book's off-white page, not a tone. A card
    // still reads as a panel on it — the step stays above 1.1:1 — but a
    // ground dark enough to read as a colour would be a band, not a page.
    const step = contrastRatio(opaque(color.paper), opaque(color.wkBg))
    expect(step).toBeGreaterThan(1.1)
    expect(step).toBeLessThan(1.25)
  })
})

/**
 * Roll-table bands in the surface tone (`RollTableInstrument`).
 *
 * Every other row of a roll table wears its surface's band: a quarter of the
 * tone into paper (`rollBandColor`), cream where the surface has none. The
 * rows print ink at body size, so each band a surface can pass owes 4.5:1:
 * every chapter band (the SRD's roll-table pages), every guide's own tone (a
 * guide step's table) and every tech-level band a show page can wear.
 */
describe('roll-table bands in the surface tone', () => {
  const guideTones = SalvageUnionReference.Guides.all().flatMap((guide) => {
    const tone = entityGuideToneColor(guide as SURefMetaEntity)
    return tone ? [tone] : []
  })
  const techLevels = ['1', '2', '3', '4', '5', '6', 'b', 'n'].map((tl) => `var(--color-tl-${tl})`)
  const tones = [...new Set([...Object.values(CHAPTER_BAND_COLOR), ...guideTones, ...techLevels])]

  test('the guard found the guide tones', () => {
    expect(guideTones.length).toBeGreaterThan(0)
  })

  test('a surface without a tone bands in cream', () => {
    expect(rollBandColor(undefined)).toBe('var(--color-band-cream)')
    expect(contrastRatio(opaque(color.bandCream), INK)).toBeGreaterThanOrEqual(4.5)
  })

  for (const tone of tones) {
    test(`ink clears 4.5:1 on the band ${tone} paints`, () => {
      expect(contrastRatio(opaque(rollBandColor(tone)), INK)).toBeGreaterThanOrEqual(4.5)
    })
  }
})

/**
 * Poster text on the sheet tones.
 *
 * The wizard banner, the mode chooser's h1 and the guided ModeDoor print on a
 * sheet's tone, and printed paper there: 2.4:1 on pilot, under even the 3:1
 * large-text floor, while the door's ink body measured 4.17:1 on crawler pink.
 * They now read `--tone-band` / `--on-tone-band`, which each `.sheet--*` rule
 * in `styles/theme.css` sets. The rules are read off the stylesheet, so this
 * holds them to the `onTone` rule — the band `textBand` paints, the
 * foreground `onTone` picks — and to 4.5:1, since the door's body copy is
 * small text.
 */
describe('poster text on the sheet tones', () => {
  const css = readFileSync(join(import.meta.dir, '../../styles/theme.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  )
  const sheet = (kind: string) => {
    // Its own rule, not the shared `.sheet--pilot, .sheet--mech, .sheet--crawler`
    // one: the own rule is the one that sets `--tone-default`.
    const body =
      [...css.matchAll(new RegExp(`\\.sheet--${kind}\\s*\\{([^}]*)\\}`, 'g'))]
        .map((m) => m[1] ?? '')
        .find((b) => /(?:^|[;\s])--tone-default:/.test(b)) ?? ''
    const decl = (prop: string) =>
      body.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+);`))?.[1]?.trim()
    const tone = decl('--tone-default') ?? ''
    // `--tone-band` may name the sheet's own tone; read it as the default.
    const band = decl('--tone-band')?.replace('var(--tone)', tone)
    return { tone, band, text: decl('--on-tone-band') }
  }

  for (const kind of ['pilot', 'mech', 'crawler']) {
    test(`the ${kind} sheet's poster text follows onTone and clears 4.5:1`, () => {
      const { tone, band, text } = sheet(kind)
      expect(resolveColor(tone)).toBeDefined()
      const ground = band ? resolveColor(band) : undefined
      const fg = text ? resolveColor(text) : undefined
      expect(ground).toEqual(resolveColor(textBand(tone) ?? ''))
      expect(fg).toEqual(FOREGROUND[onTone(tone)])
      if (!ground || !fg) return
      expect(contrastRatio(ground, fg)).toBeGreaterThanOrEqual(4.5)
    })
  }

  test('paper on the bare pilot tone fails even the large-text floor — the bug', () => {
    expect(contrastRatio(opaque(color.sheetPilot), PAPER)).toBeLessThan(3)
  })
})

/**
 * The wizard step card (`--tone-card`, WizShell's `.wiz-step-card`).
 *
 * The card is a relative OKLCH step off the sheet tone, which `resolveColor`
 * does not model, so this reads the step off `theme.css` and paints it as
 * Chromium does: OKLab there and back, each channel clipped to sRGB. That
 * gives the fills axe measured (pilot #ffc09d, mech #aabdb4, crawler
 * #e296bb). Copy printed straight on the card takes `--tone-card-ink` (onTone:
 * ink on every card); `wkMuted` printed there fails on all three. ITUN's
 * "Compositions/Wizard/Step Card" stories put every step on the real card for
 * the catalog's axe scan.
 */
describe('the wizard step card', () => {
  const css = readFileSync(join(import.meta.dir, '../../styles/theme.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  )
  const step = css.match(
    /--tone-card:\s*oklch\(from var\(--tone\) calc\(l \+ ([\d.]+)\) calc\(c \* ([\d.]+)\) h\);/
  )
  const cardInk = css.match(/--tone-card-ink:\s*([^;]+);/)?.[1]?.trim() ?? ''

  const toLinear = (v: number) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
  const toneCard = ([r, g, b]: Rgb, lift: number, scale: number): Rgb => {
    const [R, G, B] = [r, g, b].map(toLinear) as [number, number, number]
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s + lift
    const a = (1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s) * scale
    const bb = (0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s) * scale
    const l3 = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3
    const m3 = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3
    const s3 = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3
    return [
      4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
      -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
      -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
    ].map((c) => Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255)) as unknown as Rgb
  }
  const card = (tone: string): Rgb => toneCard(opaque(tone), Number(step?.[1]), Number(step?.[2]))

  test('theme.css still derives the card by the step this models', () => {
    expect(step).not.toBeNull()
    expect(resolveColor(cardInk)).toEqual(INK)
  })

  for (const [kind, tone, measured] of [
    ['pilot', color.sheetPilot, [0xff, 0xc0, 0x9d]],
    ['mech', color.sheetMech, [0xaa, 0xbd, 0xb4]],
    ['crawler', color.sheetCrawler, [0xe2, 0x96, 0xbb]],
  ] as const) {
    test(`the ${kind} card paints the fill axe measured`, () => {
      expect(card(tone)).toEqual(measured)
    })

    test(`the ${kind} card's ink is the foreground onTone picks and clears 4.5:1`, () => {
      const fill = card(tone)
      const hex = `#${fill.map((v) => v.toString(16).padStart(2, '0')).join('')}`
      expect(onTone(hex)).toBe('ink')
      expect(contrastRatio(fill, opaque(cardInk))).toBeGreaterThanOrEqual(TEXT_CONTRAST)
    })

    // Why copy on the card inherits the card ink: BackgroundStep's intro, and
    // `Slab countInk="inherit"` / `EmptyState bodyInk="inherit"` where a step
    // prints them straight on the card (3.78 / 3.03 / 2.65:1 muted).
    test(`wkMuted on the ${kind} card fails AA`, () => {
      expect(contrastRatio(card(tone), opaque(color.wkMuted))).toBeLessThan(TEXT_CONTRAST)
    })
  }
})

describe('resolveColorOver', () => {
  const WHITE: Rgb = [255, 255, 255]

  test('composites a translucent colour over its ground by its alpha', () => {
    expect(resolveColorOver('rgb(0 0 0 / 0.5)', WHITE)).toEqual([127.5, 127.5, 127.5])
    expect(resolveColorOver('rgb(0 0 0 / 25%)', WHITE)).toEqual([191.25, 191.25, 191.25])
    expect(resolveColorOver('rgb(0 0 0/1)', WHITE)).toEqual([0, 0, 0])
  })

  test('reads a translucent token through its variable', () => {
    const [r, g, b] = INK
    const [pr, pg, pb] = PAPER
    expect(resolveColorOver('var(--color-ink-50)', PAPER)).toEqual([
      (r + pr) / 2,
      (g + pg) / 2,
      (b + pb) / 2,
    ])
  })

  test('an opaque colour paints itself, whatever the ground', () => {
    expect(resolveColorOver('var(--color-ink)', WHITE)).toEqual(INK)
    expect(resolveColorOver('#ff8000', [0, 0, 0])).toEqual([255, 128, 0])
  })

  test('refuses what it does not model', () => {
    expect(resolveColorOver('var(--color-not-a-token)', WHITE)).toBeUndefined()
    expect(resolveColorOver('red', WHITE)).toBeUndefined()
    expect(resolveColorOver('color-mix(in srgb, black 20%, transparent)', WHITE)).toBeUndefined()
  })

  test('rejects a long run of spaces without backtracking (CodeQL js/polynomial-redos)', () => {
    const start = performance.now()
    expect(resolveColorOver(`rgb(1\t1\t1 /${' '.repeat(100_000)}`, WHITE)).toBeUndefined()
    expect(performance.now() - start).toBeLessThan(500)
  })
})

/**
 * Muted text over the known light grounds.
 *
 * The ink alpha rungs are translucent, so `resolveColor` refuses them and the
 * guard above never saw them: the Dashboard printed `ink-50` text in twenty
 * rules at 3.04–3.14:1. Composited over each ground a page paints — card
 * paper, the workshop grounds, and the band-cream of the Dashboard's
 * instrument chassis — the rung that reads muted is measured, not assumed.
 */
describe('muted text, composited over the known grounds', () => {
  const GROUNDS = {
    paper: color.paper,
    wkBg: color.wkBg,
    wkBg2: color.wkBg2,
    bandCream: color.bandCream,
  } as const

  const over = (fg: string, ground: string): number => {
    const bg = opaque(ground)
    const painted = resolveColorOver(fg, bg)
    if (!painted) throw new Error(`cannot composite ${fg}`)
    return contrastRatio(painted, bg)
  }

  for (const [name, ground] of Object.entries(GROUNDS)) {
    test(`wk-muted and ink-75 clear 4.5:1 on ${name}; ink-50 does not`, () => {
      expect(over('var(--color-wk-muted)', ground)).toBeGreaterThanOrEqual(4.5)
      expect(over('var(--color-ink-75)', ground)).toBeGreaterThanOrEqual(4.5)
      // Why ink-50 is a hairline and ghost rung, never a text colour.
      expect(over('var(--color-ink-50)', ground)).toBeLessThan(4.5)
    })
  }
})

/**
 * Badge tone contrast.
 *
 * Each `.su-badge--tone-*` rule in `styles/index.css` sets the fill and the
 * text a tone chip prints. The text is `--text-badge` (11px), far under
 * WCAG's large-text sizes, so every tone owes 4.5:1. The rules are read off
 * the stylesheet, not restated here, so a re-tone or a new tone is measured
 * the day it lands. Ok and warn printed paper at 3.72:1 and 3.31:1 — on the
 * Damaged badge players act on — until they took ink.
 */
describe('badge tone contrast', () => {
  const css = readPackageStylesheet().replace(/\/\*[\s\S]*?\*\//g, '')
  const tones = [...css.matchAll(/\.su-badge--tone-([a-z-]+)\s*\{([^}]*)\}/g)].map(
    ([, tone, body]) => {
      const decl = (prop: string) =>
        (body ?? '').match(new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+);`))?.[1]?.trim()
      return { tone: tone ?? '', fill: decl('background-color'), text: decl('color') }
    }
  )

  test('the guard found every tone', () => {
    expect(tones.map((t) => t.tone).sort()).toEqual(
      ['bad', 'crawler', 'game', 'mech', 'ok', 'pilot', 'warn'].sort()
    )
  })

  test('badge text is under the large-text threshold, so owes 4.5:1', () => {
    expect(px(fontSize.badge)).toBeLessThan(LARGE_BOLD_TEXT_PX)
  })

  for (const tone of ['bad', 'crawler', 'game', 'mech', 'ok', 'pilot', 'warn']) {
    test(`the ${tone} badge's text clears 4.5:1 on its fill`, () => {
      const rule = tones.find((t) => t.tone === tone)
      const fill = rule?.fill ? resolveColor(rule.fill) : undefined
      const text = rule?.text ? resolveColor(rule.text) : undefined
      expect(fill).toBeDefined()
      expect(text).toBeDefined()
      if (!fill || !text) return
      expect(contrastRatio(fill, text)).toBeGreaterThanOrEqual(TEXT_CONTRAST)
    })
  }
})
