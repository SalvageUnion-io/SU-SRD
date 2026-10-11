import type { ChapterTone, EntityPageMeta } from 'component-lib'
import { ChapterBand, ChapterFoot } from 'component-lib'
import type { ReactNode } from 'react'
import { EntityPageStamps } from './EntityPageStamps'

/**
 * EntityPageFrame — a Workshop Manual page around one entity (boards 07, 08,
 * 08b): its chapter's band at the head, the title notched in and the type
 * stamps beside it; the body; and the foot band carrying the citation
 * ("p.112 · Salvage Union Workshop Manual · also in …").
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
  const hasCitation = meta.page != null || !!meta.citation
  return (
    <article className="srd-entity">
      <ChapterBand tone={tone} measure={measure} aside={<EntityPageStamps meta={meta} />}>
        {title}
      </ChapterBand>
      <div className="srd-entity__body" style={{ maxWidth: measure }}>
        {children}
      </div>
      {hasCitation && (
        <ChapterFoot
          tone={tone}
          measure={measure}
          start={meta.page != null ? `p.${meta.page}` : undefined}
          end={meta.citation}
        />
      )}
    </article>
  )
}
