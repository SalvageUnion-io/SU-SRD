import type { ChapterTone, EntityPageMeta } from 'component-lib'
import {
  buttonVariants,
  ChapterBand,
  cn,
  EntityPageStamps,
  EntityStat,
  KindLabel,
} from 'component-lib'
import type { ReactNode } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import type { PageFoot } from '../../ssg/types'
import type { BuildLink, GuideExits } from '../lib/buildLink'
import { PAGE_MEASURE } from '../lib/pageMeasure'

/**
 * EntityPageFrame — a Workshop Manual page around one entity (boards 07, 08,
 * 08b): its chapter's band at the head, the title notched in and, right of
 * it, one cluster of everything else the head carries — the parent link, the
 * stamps and "Build With This" (EDL E20: nothing but the breadcrumb sits
 * above a show page's title; on a phone the cluster follows the title, the
 * band's `asideAt="notch"`); then the body. The page's foot band — its kind
 * and its printings (`Workshop Manual · p.112`, then any reprint) — is the site
 * `Footer`'s, so the page ends once: the page module hands `entityPageFoot`
 * to the layout as its `PageResult.foot`.
 *
 * Entity, pattern and roll-table pages all wear it, so the three cannot drift.
 * `meta` comes from `resolveEntityPageMeta`, the same helpers the card's own
 * labels, header and footer read.
 */

/**
 * The band's link back to what this entity is built on, leading the cluster
 * beside the title: the label-first chip every fact is (`PATTERN OF | Mule`,
 * EDL E9), the Cantina's sheet band's `CHASSIS | Mazona` chip — it opens the parent's
 * page and Peeks it.
 */
function ParentLink({ label, entityRef, href }: EntityParent) {
  return <EntityStat label={label} entityRef={entityRef} href={href} />
}

/** What an entity is built on: the relation, the parent and its page. */
type EntityParent = { label: string; entityRef: EntityRef; href: string }

/**
 * A creation guide's foot (`guideExitsFor`): the page ends on a way out, as
 * the book's chapter openers end on an exit arrow. "Build" hands off to the Cantina's
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

type EntityPageFrameProps = {
  /** The page title: the entity's name, or a pattern's quoted name. */
  title: ReactNode
  tone: ChapterTone
  /** The band colour when the page wears its own rather than its chapter's (`bandFillFor`). */
  fill?: string
  meta: EntityPageMeta
  /** What the entity is built on, linked beside the title: a pattern's chassis. */
  parent?: EntityParent
  /** A pattern the book sanctions as a starting build: the band wears its stamp. */
  legalStartingPattern?: boolean
  /** "Build With This": the deep link into the Cantina's builder (`buildLinkFor`), ending the cluster. */
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
        measure={PAGE_MEASURE}
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
      <div className="srd-entity__body srd-page-body">
        {children}
        {exits && <GuideExitsFoot {...exits} />}
      </div>
    </article>
  )
}

/**
 * The foot of the same page, for the layout's `Footer`: the frame's chapter
 * tone (or its own `fill`) and the kind and printings `meta` carries. The
 * layout sets the one page measure.
 */
export function entityPageFoot(tone: ChapterTone, meta: EntityPageMeta, fill?: string): PageFoot {
  return { tone, fill, kind: meta.typeLabel, printings: meta.printings }
}
