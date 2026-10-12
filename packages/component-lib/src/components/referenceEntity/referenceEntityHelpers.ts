import type { CSSProperties } from 'react'
import type { Foreground } from '../../design/contrast'
import { foregroundOn } from '../../design/contrast'

/**
 * The card's accent surface: a Tailwind bg class (or the white fallback) plus an
 * optional inline backgroundColor for dynamic per-source accents. Shared by the
 * body wrapper, the interactive footer wrapper, and ReferenceEntityFooter so the
 * `headerBg || 'bg-paper'` + `headerBgColor` fallback lives in one place.
 */
export function accentSurface(
  headerBg: string | undefined,
  headerBgColor: string | undefined
): { className: string; style: CSSProperties | undefined } {
  return {
    className: headerBg || 'bg-paper',
    style: headerBgColor ? { backgroundColor: headerBgColor } : undefined,
  }
}

/**
 * Derive a CSS color value from a Tailwind bg class (e.g. 'bg-pilot' → 'var(--color-pilot)').
 * Returns undefined when headerBg is falsy so callers can skip border styling.
 */
export function borderColorFromHeaderBg(
  headerBg: string | undefined,
  headerBgColor?: string
): string | undefined {
  if (headerBgColor) return headerBgColor
  return headerBg ? `var(--color-${headerBg.replace('bg-', '')})` : undefined
}

/**
 * Deeper (darker) tint of the card's accent (header) colour — the "deep" variant:
 * the sub-header and footer bands, and the white body box's 3px left accent border.
 *
 * 60% tone, not the 65% it was: the footer prints 12px text on this band, which
 * owes 4.5:1, and TL1's deep shade at 65% gave its best foreground (paper) only
 * 4.05:1. At 60% every card tone clears 4.5:1 — `design/contrast.test.ts` holds it.
 */
export function accentDeepColor(
  headerBg: string | undefined,
  headerBgColor?: string
): string | undefined {
  const base = borderColorFromHeaderBg(headerBg, headerBgColor)
  return base ? `color-mix(in srgb, ${base} 60%, black)` : undefined
}

/** The text-colour class for each foreground a band may print in. */
export type OnToneText = 'text-ink' | 'text-paper'

const ON_TONE_TEXT: Record<Foreground, OnToneText> = { ink: 'text-ink', paper: 'text-paper' }

/**
 * Tones that carry neither ink nor paper at 4.5:1, each with the deeper band
 * painted in its place wherever text sits on it (ruleset §3.8). Crawler pink
 * is the one: ink measures 4.2:1 on it and paper 3.7:1, so a crawler band that
 * carries text is `--color-crawler-band`, where paper measures 4.6:1.
 */
const TEXT_BAND: Partial<Record<string, string>> = {
  'var(--color-crawler)': 'var(--color-crawler-band)',
}

/**
 * The band a tone fill paints when it carries text: the tone itself, or the
 * deeper band that stands in for it (crawler pink → the crawler band).
 */
export function textBand(band: string | undefined): string | undefined {
  return band === undefined ? undefined : (TEXT_BAND[band.trim()] ?? band)
}

/**
 * The text class for a tone band (header, sub-header, footer): ink or paper,
 * whichever contrasts more with the band actually painted — see
 * `design/contrast.ts`. `fallback` covers a band the arithmetic cannot resolve.
 *
 * The crawler case: a band that carries text is painted `textBand(band)`, so
 * crawler pink is measured as the crawler band it becomes, and reads paper.
 */
export function onToneText(
  band: string | undefined,
  fallback: OnToneText = 'text-paper'
): OnToneText {
  return ON_TONE_TEXT[foregroundOn(textBand(band), fallback === 'text-ink' ? 'ink' : 'paper')]
}
