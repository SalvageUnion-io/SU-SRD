/**
 * The entity card's header GRAIN — the light speckle (ruleset §3.5, board 05c)
 * on its two header fills (§5):
 *
 *   - `ink`   — ink speckle on a TONE header (things you have);
 *   - `paper` — paper flecks on an INK header (things you do).
 *
 * Built from the `speckle` tokens as a self-contained SVG image, so it needs no
 * page-level `<defs>` (the reference site renders most cards to static HTML, and a card can
 * mount anywhere): each layer is a rect run through its `feTurbulence` filter,
 * and the image has no intrinsic size, so it fills whatever band it is the
 * background of. Grain, not shading — nothing interpolates between colours.
 *
 * On every brand-colour band, a Peek's and the Cockpit's too (R10); never on paper,
 * buttons or fields: `tokens/texture-placement` keeps the token
 * references out of those files.
 *
 * Every header band on a listing wears one, so the image is a stylesheet class
 * (`.su-grain--ink` / `.su-grain--paper` in `styles/partials/card-chrome.css`), not an inline
 * style (ADR-046, repeated elements): inline, its ~1.9 KB data URI on every
 * band was over a tenth of the reference site's HTML. The classes read `styles/grain/*.svg`,
 * which the bundler inlines into the built stylesheet once; those files are
 * this function's output, and `__tests__/stylesheetParity.test.ts` fails when
 * one drifts from the `speckle` tokens.
 */

import { speckle } from '../../../design/tokens'

export type CardGrain = keyof typeof speckle.grains

/** The grain's SVG, from the `speckle` tokens: what `styles/grain/<grain>.svg` holds. */
export function grainSvg(grain: CardGrain): string {
  const layers = speckle.grains[grain]
  const filters = layers
    .map(({ filter }) => {
      const f = speckle.filters[filter]
      return (
        `<filter id='${f.id}' x='0' y='0' width='100%' height='100%'>` +
        `<feTurbulence type='fractalNoise' baseFrequency='${f.baseFrequency}' numOctaves='${f.numOctaves}' seed='${f.seed}' result='n'/>` +
        `<feColorMatrix in='n' type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${f.gain} 0 0 0 ${f.threshold}' result='m'/>` +
        `<feComposite in='SourceGraphic' in2='m' operator='in'/>` +
        '</filter>'
      )
    })
    .join('')
  const rects = layers
    .map(
      ({ filter, fill, opacity }) =>
        `<rect width='100%' height='100%' fill='${fill}' opacity='${opacity}' filter='url(#${speckle.filters[filter].id})'/>`
    )
    .join('')
  // Decorative: `aria-hidden` says so (and satisfies the SVG lint on the files).
  return `<svg xmlns='http://www.w3.org/2000/svg' aria-hidden='true' width='100%' height='100%'>${filters}${rects}</svg>`
}

/** The class whose background layer a header band wears for `grain` (none when absent). */
export function grainClass(grain: CardGrain | undefined): string | undefined {
  return grain ? `su-grain--${grain}` : undefined
}
