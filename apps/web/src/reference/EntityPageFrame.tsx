import type { ReactNode } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import type { ChapterTone, EntityPageMeta } from '../components/index'
import { Button, ChapterBand, EntityPageStamps, KindLabel, NextLabel } from '../components/index'
import { SharePageIsland } from '../components/islands/SharePageIsland'
import type { BuildLink, GuideExits } from '../lib/buildLink'
import { PAGE_MEASURE } from '../lib/pageMeasure'
import { Island } from '../runtime/Island'

/**
 * EntityPageFrame — a Workshop Manual page around one entity: its chapter's
 * band at the head, the title notched in and, right of
 * it, one cluster of everything else the head carries — the parent link, the
 * stamps, then Share and "Build With This" (EDL E20: nothing but the
 * breadcrumb sits above a show page's title; on a phone the cluster follows
 * the title, the band's `asideAt="notch"`, and the buttons, the band's
 * `action`, stay on the band beside it); then the body. The page's foot — its printings on one
 * line (`Workshop Manual · p.65 // … (CR) · p.37`), no kind — is the site
 * `Footer`'s, so the page ends once: the page module hands its printings
 * to the layout as its `PageResult.foot`.
 *
 * Entity, pattern and roll-table pages all wear it, so the three cannot drift.
 * `meta` comes from `resolveEntityPageMeta`, the same helpers the card's own
 * labels, header and footer read.
 */

/** What an entity is built on: the relation, the parent and its page. */
type EntityParent = { label: string; entityRef: EntityRef; href: string }

/**
 * A creation guide's foot (`guideExitsFor`): the page ends on a way out, as
 * the book's chapter openers end on an exit arrow. "Build" hands off to the app's
 * wizard, "Next" walks on to the following guide, and the Starter Set is the
 * shortcut past building at all.
 */
function GuideExitsFoot({ build, next, starterSet }: GuideExits) {
  return (
    <nav className="su-guide-exits" aria-label="Where next">
      <Button
        href={build.href}
        aria-label={build.ariaLabel}
        variant="primary"
        size="compact"
        className="su-page-action"
      >
        {build.label}
      </Button>
      {next && (
        <a href={next.href} className="su-guide-exits__next">
          <NextLabel to={next.label} size="full" />
        </a>
      )}
      <a href={starterSet.href} className="su-guide-exits__starter">
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
  /** "Build With This": the deep link into the app's builder (`buildLinkFor`), ending the cluster after Share (the band's `action`). */
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
    <article className="su-entity">
      <ChapterBand
        tone={tone}
        fill={fill}
        measure={PAGE_MEASURE}
        aside={
          <EntityPageStamps
            meta={meta}
            legalStartingPattern={legalStartingPattern}
            parent={parent && { label: parent.label, ref: parent.entityRef, href: parent.href }}
          />
        }
        asideAt="notch"
        action={
          <>
            {/* Live from the first idle moment, so a phone's share sheet opens
                inside the reader's own tap. */}
            <Island name="SharePageIsland" client="idle" ssr hydrate>
              <SharePageIsland />
            </Island>
            {build && (
              // A link drawn as the shared Button (`Button href`): same tab, no
              // off-site arrow — the Reference and Build are one union
              // (ruleset §3.11).
              <Button
                href={build.href}
                aria-label={build.ariaLabel}
                variant="primary"
                size="compact"
                className="su-page-action su-hit-area"
              >
                {build.label}
              </Button>
            )}
          </>
        }
        lead={
          // An ability's level, left of its title as its Compact sets it: just the number.
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
      <div className="su-entity__body su-page-body">
        {children}
        {exits && <GuideExitsFoot {...exits} />}
      </div>
    </article>
  )
}
