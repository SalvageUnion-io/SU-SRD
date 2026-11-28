/**
 * The `chrome-tokens` rule set's `slide-turn` rule (chrome K3), kept beside
 * `chromeTokens.ts`, which runs it and exempts the slideshow's keyframes from
 * `loading-mark` (K6).
 */

import type { CssBlock, CssDecl } from '../lib/styleSource'

/**
 * The one loop that is no loading mark (chrome K3, K6): the home's slideshow
 * (`HomeHero`), its keyframes in its partial and nowhere else.
 */
export const SLIDESHOW = {
  file: 'apps/web/src/styles/partials/front.css',
  keyframes: '@keyframes su-front-show',
} as const

export const isSlideshow = (header: string, rel: string) =>
  rel === SLIDESHOW.file && header.trim() === SLIDESHOW.keyframes

/**
 * The slideshow's slide out of its turn is hidden (K3): its first and last
 * keyframes (`0%`/`from`, `100%`/`to`) each set `visibility: hidden`, so a
 * slide not in view is never hit, focused or read over the one that is.
 */
const slideTurnCss = (decls: CssDecl[], blocks: CssBlock[], rel: string) => {
  if (rel !== SLIDESHOW.file) return []
  const show = blocks.find((b) => isSlideshow(b.header, rel))
  if (!show) return []
  const stops = (header: string) => header.split(',').map((s) => s.trim())
  const hiddenAt = (stop: string, alias: string) =>
    decls.some(
      (d) =>
        isSlideshow(d.context[0] ?? '', rel) &&
        stops(d.context[1] ?? '').some((s) => s === stop || s === alias) &&
        d.prop === 'visibility' &&
        d.value.trim() === 'hidden'
    )
  return [
    ['0%', 'from'],
    ['100%', 'to'],
  ]
    .filter(([stop = '', alias = '']) => !hiddenAt(stop, alias))
    .map(([stop]) => ({ line: show.line, detail: `${show.header}: ${stop} is not hidden` }))
}

/** The rule as `chromeTokens.ts` registers it. */
export const slideTurnRule = {
  id: 'slide-turn',
  mode: 'zero',
  rule: 'chrome K3 — the home slideshow hides a slide out of its turn',
  fix: 'In `@keyframes su-front-show` (SLIDESHOW, packages/gates/rules/slideshow.ts), set `visibility: hidden` at `0%` and at `100%` beside `opacity: 0`, so a slide before or after its turn is never hit, focused or read over the one in view.',
  css: slideTurnCss,
} as const
