import { color } from './tokens'

/**
 * WCAG contrast over the token scale — the ONE place a band's foreground is
 * decided from its background.
 *
 * Card bands are painted with CSS strings, not with literals: a theme variable
 * (`var(--color-tl-3)`), or a `color-mix()` of one (the deep shade under a
 * header, the ghosted band of a nested action, the grey of a damaged card).
 * A rule of thumb ("solid tones read paper") is wrong for half the palette:
 * paper measures 1.79:1 on TL1, 2.41:1 on pilot and 3.03:1 on mech. So this
 * resolves the band to the
 * sRGB triple the browser will paint, by the same arithmetic, and lets WCAG's
 * relative luminance choose.
 *
 * Pure and DOM-free (no `getComputedStyle`): it reads `tokens.ts`, which
 * `tokens.parity.test.ts` holds equal to the stylesheet, so a re-tone in
 * `theme.css` moves the decision with it.
 */

export type Rgb = readonly [number, number, number]

/** WCAG 2.x relative luminance of an sRGB triple (0–255 channels). */
function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two opaque colours, 1–21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

/** Split on the commas that are not inside parentheses. */
function topLevelArgs(body: string): string[] {
  const args: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      args.push(body.slice(start, i).trim())
      start = i + 1
    }
  }
  args.push(body.slice(start).trim())
  return args
}

/** `color-mix(in srgb, A p%, B q%)` — the percentages normalised as CSS does. */
function resolveMix(body: string): Rgb | undefined {
  const [space, first, second] = topLevelArgs(body)
  if (space !== 'in srgb' || first === undefined || second === undefined) return undefined
  const split = (arg: string): [string, number | undefined] => {
    const m = arg.match(/^(.*\S)\s+([\d.]+)%$/)
    return m ? [m[1] ?? '', Number(m[2])] : [arg, undefined]
  }
  const [aCss, aPct] = split(first)
  const [bCss, bPct] = split(second)
  const a = resolveColor(aCss)
  const b = resolveColor(bCss)
  if (!a || !b) return undefined
  const pa = aPct ?? (bPct === undefined ? 50 : 100 - bPct)
  const pb = bPct ?? 100 - pa
  // Percentages summing under 100 also scale alpha, so the band would be
  // translucent and its ground unknown.
  if (pa + pb < 100) return undefined
  const t = pa / (pa + pb)
  return [0, 1, 2].map((i) => (a[i] ?? 0) * t + (b[i] ?? 0) * (1 - t)) as unknown as Rgb
}

const KEYWORDS: Record<string, Rgb> = { black: [0, 0, 0], white: [255, 255, 255] }

/**
 * The token value a `var(--color-*)` names: `null` when `value` is not such a
 * reference, `undefined` when it names no token on the scale.
 */
function colorToken(value: string): string | undefined | null {
  const variable = value.match(/^var\(\s*--color-([a-z0-9-]+)\s*\)$/)
  if (!variable) return null
  const key = (variable[1] ?? '').replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
  return (color as Record<string, string>)[key]
}

/**
 * The opaque sRGB a CSS colour string paints, or `undefined` when it cannot be
 * known without the page: an unknown variable, a translucent colour (its ground
 * decides: `resolveColorOver` composites it over a known one), or a syntax
 * this does not model. Understands rgb and six-digit hex, `black`/`white`,
 * `var(--color-*)` over the token scale, and `color-mix(in srgb, …)` of any of
 * those.
 */
export function resolveColor(css: string): Rgb | undefined {
  const value = css.trim()
  const keyword = KEYWORDS[value]
  if (keyword) return keyword
  const rgb = value.match(
    /^rgb\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:(\/)\s*[\d.]+\s*)?\)$/
  )
  if (rgb) return rgb[4] ? undefined : [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  const hex = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (hex)
    return [parseInt(hex[1] ?? '', 16), parseInt(hex[2] ?? '', 16), parseInt(hex[3] ?? '', 16)]
  const token = colorToken(value)
  if (token !== null) return token ? resolveColor(token) : undefined
  const mix = value.match(/^color-mix\((.*)\)$/)
  if (mix) return resolveMix(mix[1] ?? '')
  return undefined
}

/**
 * The opaque sRGB a CSS colour paints over a KNOWN opaque `ground`: what
 * `resolveColor` refuses because the page decides it, decided. An opaque
 * colour paints itself; a translucent rgb colour with an alpha — directly or
 * via a `var(--color-*)` token, such as the `ink50` rung — is composited over
 * the ground by its alpha, as the browser does. `undefined` for what neither
 * models.
 */
export function resolveColorOver(css: string, ground: Rgb): Rgb | undefined {
  const opaque = resolveColor(css)
  if (opaque) return opaque
  const value = css.trim()
  const token = colorToken(value)
  if (token !== null) return token ? resolveColorOver(token, ground) : undefined
  const rgba = value.match(
    /^rgb\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*\/\s*([\d.]+)(%?)\s*\)$/
  )
  if (!rgba) return undefined
  const alpha = Math.min(1, Number(rgba[4]) / (rgba[5] ? 100 : 1))
  return [1, 2, 3].map(
    (i, at) => Number(rgba[i]) * alpha + (ground[at] ?? 0) * (1 - alpha)
  ) as unknown as Rgb
}

/** The two foregrounds a band may print in, by token name. */
export type Foreground = 'ink' | 'paper'

const FOREGROUND: Record<Foreground, Rgb> = {
  ink: resolveColor(color.ink) as Rgb,
  paper: resolveColor(color.paper) as Rgb,
}

/**
 * The foreground for text printed on `band`: whichever of ink and paper
 * contrasts more with it by WCAG relative luminance. A band that cannot be
 * resolved keeps `fallback` — the caller's best guess without the arithmetic.
 */
export function foregroundOn(band: string | undefined, fallback: Foreground = 'paper'): Foreground {
  const ground = band ? resolveColor(band) : undefined
  if (!ground) return fallback
  return contrastRatio(FOREGROUND.ink, ground) > contrastRatio(FOREGROUND.paper, ground)
    ? 'ink'
    : 'paper'
}

/** WCAG AA for body text: the ratio a foreground must reach to print on a band. */
export const TEXT_CONTRAST = 4.5
