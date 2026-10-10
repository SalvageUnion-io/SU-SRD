import type { CSSProperties } from 'react'
import { useId } from 'react'
import { speckle } from '../../design/tokens'

/**
 * Speckle — the light speckle (ruleset §3.5 "Texture", board 05c) as a layer
 * laid behind a band's content: ink grain on a colour band, paper flecks on an
 * ink ground. Generated from the `speckle` tokens, never a scanned scuff.
 *
 * Internal to the chrome that wears it (`ChapterBand`, the Union bar
 * `AppBar`), so the texture tokens are read in this one file and the
 * `tokens/texture-placement` guard can see every place they land.
 *
 * ## Placement contract
 *
 * The parent must be `position: relative` with `isolation: isolate`: each
 * layer is absolutely positioned at `z-index: -1`, which inside that stacking
 * context paints above the parent's own background and below every in-flow
 * child. So a notched title on clean ground stays clean, and nothing the
 * content draws is dimmed by the grain.
 *
 * ## Ids
 *
 * Each layer carries its own filter, under an id unique to this instance
 * (`useId`), because two bands on one page would otherwise declare the same
 * `su-blot` twice — invalid HTML, and the second band would silently render
 * through the first one's filter.
 */

export type SpeckleGrain = keyof typeof speckle.grains

type SpeckleProps = {
  /** `ink` — grain on a colour band. `paper` — flecks on an ink ground. */
  grain: SpeckleGrain
}

const LAYER = {
  height: '100%',
  inset: 0,
  pointerEvents: 'none',
  position: 'absolute',
  width: '100%',
  zIndex: -1,
} satisfies CSSProperties

export function Speckle({ grain }: SpeckleProps) {
  // `useId` is opaque; keep only the characters an SVG `url(#…)` reference
  // takes unescaped.
  const uid = useId().replace(/[^\w-]/g, '')
  return (
    <>
      {speckle.grains[grain].map((layer) => {
        const filter = speckle.filters[layer.filter]
        const id = `${filter.id}-${uid}`
        return (
          <svg key={filter.id} aria-hidden="true" focusable="false" style={LAYER}>
            <filter id={id} x="0" y="0" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency={filter.baseFrequency}
                numOctaves={filter.numOctaves}
                seed={filter.seed}
                result="n"
              />
              <feColorMatrix
                in="n"
                type="matrix"
                values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${filter.gain} 0 0 0 ${filter.threshold}`}
                result="m"
              />
              <feComposite in="SourceGraphic" in2="m" operator="in" />
            </filter>
            <rect
              width="100%"
              height="100%"
              fill={layer.fill}
              opacity={layer.opacity}
              filter={`url(#${id})`}
            />
          </svg>
        )
      })}
    </>
  )
}
