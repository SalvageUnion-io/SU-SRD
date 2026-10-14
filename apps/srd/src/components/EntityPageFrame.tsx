import type { ChapterTone, EntityPageMeta } from 'component-lib'
import { buttonVariants, ChapterBand, cn, EntityPageStamps, KindLabel } from 'component-lib'
import type { ReactNode } from 'react'
import type { PageFoot } from '../../ssg/types'
import type { BuildLink, GuideExits } from '../lib/buildLink'

/**
 * EntityPageFrame — a Workshop Manual page around one entity (boards 07, 08,
 * 08b): its chapter's band at the head, the title notched in and, right of
 * it, one cluster of everything else the head carries — the parent link, the
 * stamps and "Build With This" (EDL E20: nothing but the breadcrumb sits
 * above a show page's title; on a phone the cluster follows the title, the
 * band's `asideAt="notch"`); then the body. The page's foot band — its kind
 * stamp and its printings (`Workshop Manual | p.112`, then any reprint) — is the site
 * `Footer`'s, so the page ends once: the page module hands `entityPageFoot`
 * to the layout as its `PageResult.foot`.
 *
 * Entity, pattern and roll-table pages all wear it, so the three cannot drift.
 * `meta` comes from `resolveEntityPageMeta`, the same helpers the card's own
 * labels, header and footer read.
 */

/**
 * The band's link back to what this entity is built on, leading the cluster
 * beside the title: a stamp naming the relation ("Pattern of") and the parent's name as a link,
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

/**
 * A creation guide's foot (`guideExitsFor`): the page ends on a way out, as
 * the book's chapter openers end on an exit arrow. "Build" hands off to ITUN's
 * wizard, "Next" walks on to the following guide, and the Starter Set is the
 * shortcut past building at all.
 */
function GuideExitsFoot({ build, next, starterSet }: GuideExits) {
  return (
    <nav className="srd-guide-exits" aria-label="Where next">
      <a
        href={build.href}
        aria-label={build.ariaLabel}
        className={cn(buttonVariants({ variant: 'primary', size: 'compact' }), 'su-page-action')}
      >
        {build.label}
      </a>
      {next && (
        <a href={next.href} className="srd-guide-exits__next">
          {next.label}
          <span aria-hidden="true">→</span>
        </a>
      )}
      <a href={starterSet.href} className="srd-guide-exits__starter">
        {starterSet.label}
      </a>
    </nav>
  )
}

/** An entity page's measure (board 07). */
const ENTITY_PAGE_MEASURE = '75rem'

type EntityPageFrameProps = {
  /** The page title: the entity's name, or a pattern's quoted name. */
  title: ReactNode
  tone: ChapterTone
  /** The band colour when the page wears its own rather than its chapter's (`bandFillFor`). */
  fill?: string
  meta: EntityPageMeta
  /** The inner row's max width; the roll-table page runs wider (board 08b). */
  measure?: string
  /** What the entity is built on, linked beside the title: a pattern's chassis. */
  parent?: { label: string; name: string; href: string }
  /** A pattern the book sanctions as a starting build: the band wears its stamp. */
  legalStartingPattern?: boolean
  /** "Build With This": the deep link into ITUN's builder (`buildLinkFor`), ending the cluster. */
  build?: BuildLink | null
  /** A creation guide's way out (`guideExitsFor`), under the body. */
  exits?: GuideExits | null
  children: ReactNode
}

export function EntityPageFrame({
  title,
  tone,
  fill,
  meta,
  measure = ENTITY_PAGE_MEASURE,
  parent,
  legalStartingPattern,
  build,
  exits,
  children,
}: EntityPageFrameProps) {
  return (
    <article className="srd-entity">
      <ChapterBand
        tone={tone}
        fill={fill}
        measure={measure}
        aside={
          <EntityPageStamps
            meta={meta}
            name={typeof title === 'string' ? title : undefined}
            legalStartingPattern={legalStartingPattern}
            lead={parent && <ParentLink {...parent} />}
            end={
              build && (
                // A link that looks like the shared Button (`buttonVariants`):
                // same tab, no off-site arrow — the Reference and Build are one
                // union (ruleset §3.11).
                <a
                  href={build.href}
                  aria-label={build.ariaLabel}
                  className={cn(
                    buttonVariants({ variant: 'primary', size: 'compact' }),
                    'su-page-action'
                  )}
                >
                  {build.label}
                </a>
              )
            }
          />
        }
        asideAt="notch"
        lead={
          // An ability's level, left of its title as its Row sets it: just the number.
          meta.numeral && (
            <>
              <span className="su-sr-only">Level </span>
              {meta.numeral}
            </>
          )
        }
      >
        {title}
        <KindLabel kind={meta.typeLabel} />
      </ChapterBand>
      <div className="srd-entity__body" style={{ maxWidth: measure }}>
        {children}
        {exits && <GuideExitsFoot {...exits} />}
      </div>
    </article>
  )
}

/**
 * The foot of the same page, for the layout's `Footer`: the frame's chapter
 * tone (or its own `fill`) and measure, and the kind and printings `meta` carries.
 */
export function entityPageFoot(
  tone: ChapterTone,
  meta: EntityPageMeta,
  measure: string = ENTITY_PAGE_MEASURE,
  fill?: string
): PageFoot {
  return { tone, fill, kind: meta.typeLabel, printings: meta.printings, measure }
}
