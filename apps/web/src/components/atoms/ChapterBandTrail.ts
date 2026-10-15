import type { ReactNode } from 'react'
import { createContext } from 'react'

/**
 * The page's breadcrumb trail, provided by the site's layout around the page:
 * a page band (`scale="page"`) without an `eyebrow` of its own sets it on the
 * band above the title wherever the Union bar does not hold it
 * (`.su-chapter-band__trail`).
 */
export const ChapterBandTrail = createContext<ReactNode>(null)
