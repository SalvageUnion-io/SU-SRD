import type { CSSProperties } from 'react'
import type { CSSVarStyle } from '../../styles/cssVars'
import { HERO_ART_CROP } from './heroArtCrop.data'

/**
 * heroArtCrop — how the entity page's hero crops its artwork to the line art
 * The artwork ships on the book's canvas with a margin that
 * differs per image (the Mule's ink fills 75% × 60% of it, a bio-titan's
 * ~96%), so the box each image's ink sits in is measured once
 * (`bun run assets:crop`) and looked up here by the image's own URL.
 *
 * The crop window takes the ink's aspect ratio; the image inside it is scaled
 * up and offset so the ink fills the window exactly. Cropping to the ink's
 * bounding box can never cut a line off. An image with no entry (new art not
 * yet measured) returns null and renders whole.
 */

export type HeroArtCrop = {
  /** On the figure: the ink's aspect ratio, which sizes the plate. */
  frame: CSSVarStyle
  /** On the image: scaled and offset inside the crop window. */
  image: CSSProperties
}

const percent = (n: number) => `${Math.round(n * 1_000_000) / 10_000}%`

/** The `schemaName/slug` key of an artwork URL (`…/chassis/mule.webp`), or undefined. */
function artKey(url: string): string | undefined {
  const match = /\/([^/]+)\/([^/]+?)(?:-\d+(?:q\d+)?)?\.webp$/.exec(url)
  return match ? `${match[1]}/${match[2]}` : undefined
}

export function heroArtCrop(url: string): HeroArtCrop | null {
  const key = artKey(url)
  const box = key ? HERO_ART_CROP[key] : undefined
  if (!box) return null
  const [x, y, w, h, aspect] = box
  return {
    frame: { '--su-art-aspect': aspect },
    image: {
      height: percent(1 / h),
      left: percent(-x / w),
      top: percent(-y / h),
      width: percent(1 / w),
    },
  }
}
