import type { PageFoot } from '../../ssg/types'
import type { EntityPageMeta } from '../components/index'

/**
 * The foot of an `EntityPageFrame` page, for the layout's `Footer`: the
 * printings `meta` carries, cited on one line in the page's one footer, which
 * wears the page's band (no kind: ruleset Source 2, E9). The layout sets the
 * one page measure.
 */
export function entityPageFoot(meta: EntityPageMeta): PageFoot {
  return { printings: meta.printings }
}
