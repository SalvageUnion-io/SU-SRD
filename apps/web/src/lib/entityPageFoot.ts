import type { PageFoot } from '../../ssg/types'
import type { ChapterTone, EntityPageMeta } from '../components/index'

/**
 * The foot of an `EntityPageFrame` page, for the layout's `Footer`: the frame's chapter
 * tone (or its own `fill`) and the kind and printings `meta` carries. The
 * layout sets the one page measure.
 */
export function entityPageFoot(tone: ChapterTone, meta: EntityPageMeta, fill?: string): PageFoot {
  return { tone, fill, kind: meta.typeLabel, printings: meta.printings }
}
