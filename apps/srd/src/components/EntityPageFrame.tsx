import type { ChapterTone, EntityPageMeta } from 'component-lib'
import { ChapterBand } from 'component-lib'
import type { ReactNode } from 'react'
import type { PageFoot } from '../../ssg/types'
import { EntityPageStamps } from './EntityPageStamps'

/**
 * EntityPageFrame — a Workshop Manual page around one entity (boards 07, 08,
 * 08b): its chapter's band at the head, the title notched in and the type
 * stamps beside it; then the body. The page's foot band — the citation
 * ("p.112 · Salvage Union Workshop Manual · also in …") — is the site
 * `Footer`'s, so the page ends once: the page module hands `entityPageFoot`
 * to the layout as its `PageResult.foot`.
 *
 * Entity, pattern and roll-table pages all wear it, so the three cannot drift.
 * `meta` comes from `resolveEntityPageMeta`, the same helpers the card's own
 * seam, header and footer read.
 */

/** An entity page's measure (board 07). */
export const ENTITY_PAGE_MEASURE = '75rem'

type EntityPageFrameProps = {
  /** The page title: the entity's name, or a pattern's quoted name. */
  title: ReactNode
  tone: ChapterTone
  meta: EntityPageMeta
  /** The inner row's max width; the roll-table page runs wider (board 08b). */
  measure?: string
  children: ReactNode
}

export function EntityPageFrame({
  title,
  tone,
  meta,
  measure = ENTITY_PAGE_MEASURE,
  children,
}: EntityPageFrameProps) {
  return (
    <article className="srd-entity">
      <ChapterBand tone={tone} measure={measure} aside={<EntityPageStamps meta={meta} />}>
        {title}
      </ChapterBand>
      <div className="srd-entity__body" style={{ maxWidth: measure }}>
        {children}
      </div>
    </article>
  )
}

/**
 * The foot of the same page, for the layout's `Footer`: the frame's chapter
 * tone and measure, and the citation `meta` carries.
 */
export function entityPageFoot(
  tone: ChapterTone,
  meta: EntityPageMeta,
  measure: string = ENTITY_PAGE_MEASURE
): PageFoot {
  return { tone, page: meta.page, citation: meta.citation, measure }
}
