import type { ChapterTone, EntityPageMeta } from 'component-lib'
import { buttonVariants, ChapterBand, cn } from 'component-lib'
import type { ReactNode } from 'react'
import type { PageFoot } from '../../ssg/types'
import type { BuildLink } from '../lib/buildLink'
import { EntityPageStamps } from './EntityPageStamps'

/**
 * EntityPageFrame — a Workshop Manual page around one entity (boards 07, 08,
 * 08b): its chapter's band at the head, the title notched in and the type
 * stamps at the band's far end on the notch's row (wrapping above it when a
 * long name leaves no room: the band's `asideAt="notch"`); then the body. The page's foot band — the citation
 * ("p.112 · Salvage Union Workshop Manual · also in …") — is the site
 * `Footer`'s, so the page ends once: the page module hands `entityPageFoot`
 * to the layout as its `PageResult.foot`.
 *
 * Entity, pattern and roll-table pages all wear it, so the three cannot drift.
 * `meta` comes from `resolveEntityPageMeta`, the same helpers the card's own
 * labels, header and footer read.
 */

/**
 * The band's link back to what this entity is built on, above the title: a
 * stamp naming the relation ("Pattern of") and the parent's name as a link,
 * with an arrow (`.srd-parent-link`).
 */
function ParentLink({ label, name, href }: { label: string; name: string; href: string }) {
  return (
    <a className="srd-parent-link" href={href}>
      <span className="srd-parent-link__label">{label}</span>
      <span className="srd-parent-link__name">
        {name}
        <span aria-hidden="true"> →</span>
      </span>
    </a>
  )
}

/** An entity page's measure (board 07). */
export const ENTITY_PAGE_MEASURE = '75rem'

type EntityPageFrameProps = {
  /** The page title: the entity's name, or a pattern's quoted name. */
  title: ReactNode
  tone: ChapterTone
  /** The band colour when the page wears its own rather than its chapter's (`bandFillFor`). */
  fill?: string
  meta: EntityPageMeta
  /** The inner row's max width; the roll-table page runs wider (board 08b). */
  measure?: string
  /** What the entity is built on, linked above the title: a pattern's chassis. */
  parent?: { label: string; name: string; href: string }
  /** "Build with this": the deep link into ITUN's builder (`buildLinkFor`), atop the body. */
  build?: BuildLink | null
  children: ReactNode
}

export function EntityPageFrame({
  title,
  tone,
  fill,
  meta,
  measure = ENTITY_PAGE_MEASURE,
  parent,
  build,
  children,
}: EntityPageFrameProps) {
  return (
    <article className="srd-entity">
      <ChapterBand
        tone={tone}
        fill={fill}
        measure={measure}
        aside={<EntityPageStamps meta={meta} />}
        asideAt="notch"
        eyebrow={parent && <ParentLink {...parent} />}
      >
        {title}
      </ChapterBand>
      <div className="srd-entity__body" style={{ maxWidth: measure }}>
        {build && (
          // A link that looks like the shared Button (`buttonVariants`, as the
          // home page's "Build a pilot"): same tab, no off-site arrow — the
          // Reference and Build are one union (ruleset §3.11).
          <div className="srd-entity__build">
            <a
              href={build.href}
              className={cn(
                buttonVariants({ variant: 'primary', size: 'compact' }),
                'su-page-action'
              )}
            >
              {build.label}
            </a>
          </div>
        )}
        {children}
      </div>
    </article>
  )
}

/**
 * The foot of the same page, for the layout's `Footer`: the frame's chapter
 * tone (or its own `fill`) and measure, and the citation `meta` carries.
 */
export function entityPageFoot(
  tone: ChapterTone,
  meta: EntityPageMeta,
  measure: string = ENTITY_PAGE_MEASURE,
  fill?: string
): PageFoot {
  return { tone, fill, page: meta.page, citation: meta.citation, measure }
}
