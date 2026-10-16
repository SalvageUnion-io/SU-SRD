import type { ReactNode } from 'react'
import { createContext } from 'react'

/**
 * The page's breadcrumb trail, provided by the site's layout around the page:
 * a page band (`scale="page"`) without an `eyebrow` of its own sets it on the
 * notch's plate above the title, at every width (`.su-chapter-band__trail`).
 */
export const ChapterBandTrail = createContext<ReactNode>(null)
