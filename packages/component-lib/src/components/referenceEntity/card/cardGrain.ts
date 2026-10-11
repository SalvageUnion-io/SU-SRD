/**
 * The entity card's header GRAIN — the light speckle (ruleset §3.5, board 05c)
 * on its two header fills (§5):
 *
 *   - `ink`   — ink speckle on a TONE header (things you have);
 *   - `paper` — paper flecks on an INK header (things you do).
 *
 * Built from the `speckle` tokens as a self-contained SVG image, so it needs no
 * page-level `<defs>` (srd renders most cards to static HTML, and a card can
 * mount anywhere): each layer is a rect run through its `feTurbulence` filter,
 * and the image has no intrinsic size, so it fills whatever band it is the
 * background of. Grain, not shading — nothing interpolates between colours.
 *
 * Never on paper, buttons, fields, the Dashboard or tooltips: the card turns it
 * off there (`texture={false}`), and `tokens/texture-placement` keeps the token
 * references out of those files.
 */

import type { CSSProperties } from 'react'
import { speckle } from '../../../design/tokens'

export type CardGrain = keyof typeof speckle.grains

function grainSvg(grain: CardGrain): string {
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
  return `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'>${filters}${rects}</svg>`
}

/** Built once per grain: the string is the same for every card. */
const GRAIN_IMAGE: Record<CardGrain, string> = {
  ink: `url("data:image/svg+xml,${encodeURIComponent(grainSvg('ink'))}")`,
  paper: `url("data:image/svg+xml,${encodeURIComponent(grainSvg('paper'))}")`,
}

/** The background layer a header band wears for `grain` (none when absent). */
export function grainStyle(grain: CardGrain | undefined): CSSProperties | undefined {
  return grain ? { backgroundImage: GRAIN_IMAGE[grain] } : undefined
}
