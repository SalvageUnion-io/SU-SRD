import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import { NextLabel } from '../components/app'
import type { PageContentsEntry } from '../components/classContents.model'
import type { ChapterTone, EntityPageMeta } from '../components/index'
import { Button, ChapterBand, EntityPageStamps, KindLabel } from '../components/index'
import { ReferenceSurface } from '../components/ReferenceSurface'
import { iconSize } from '../design/tokens'
import type { BuildLink, GuideExits, MediatorLinks } from '../lib/buildLink'
import { PAGE_MEASURE } from '../lib/pageMeasure'
import { referenceCopy } from '../messages/reference'
import { PageContentsMenu } from './PageContentsMenu'
import { SharePageButton } from './SharePageButton'

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
    <nav className="su-guide-exits" aria-label={referenceCopy('whereNext')}>
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
        <Button href={next.href} size="compact" className="su-page-action">
          <NextLabel to={next.label} />
        </Button>
      )}
      <Button href={starterSet.href} variant="ghost" size="compact" className="su-page-action">
        {starterSet.label}
      </Button>
    </nav>
  )
}

/**
 * A denizen's foot for the Mediator (`mediatorLinksFor`): into an encounter of
 * theirs, or the NPC designer started from it. Static markup, shown only while
 * somebody is signed in (`html[data-srd-signed-in]`, pages.css).
 */
function MediatorActsFoot({ add, design }: MediatorLinks) {
  return (
    <nav className="su-guide-exits su-mediator-acts" aria-label={referenceCopy('forTheMediator')}>
      <Button href={add.href} variant="primary" size="compact" className="su-page-action">
        {add.label}
      </Button>
      {design && (
        <Button href={design.href} size="compact" className="su-page-action">
          {design.label}
        </Button>
      )}
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
  /** A long Page's sections (`classContentsEntries`): from `lg`, a menu on the band before Share. */
  contents?: readonly PageContentsEntry[]
  /** A book's store page (a Sources record's `purchaseLink`): the band's off-site Buy, after Share. */
  buy?: string
  /** A creation guide's way out (`guideExitsFor`), under the body. */
  exits?: GuideExits | null
  /** A denizen's Mediator links (`mediatorLinksFor`), under the body, signed in only. */
  mediator?: MediatorLinks | null
  /** A sparse Page's side column (`SparseRail`, EDL form 5), beside its body. */
  rail?: ReactNode
  /**
   * The Page's foot (`NeighbourRow`): under the body and the sidebar both, at
   * the page's bottom.
   */
  foot?: ReactNode
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
  contents,
  buy,
  exits,
  mediator,
  rail,
  foot,
  children,
}: EntityPageFrameProps) {
  return (
    <article className="su-entity">
      {/* The band and the foot are server-rendered outside the body's island:
          the SRD's routes make their chips and neighbours links. */}
      <ReferenceSurface>
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
            // The page's acts stand on the entity's header row, at its right
            // end: Share, then its one call to action (Build With This, Buy
            // this book), each a button in the band's control group (C8).
            <>
              {contents && <PageContentsMenu entries={contents} />}
              <SharePageButton />
              {buy && (
                // The store is off the site: a new tab, outlined on the band
                // (§3.13), never the page's rust.
                <Button
                  href={buy}
                  linkAs="a"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="default"
                  size="compact"
                  className="su-page-action"
                >
                  {referenceCopy('buyThisBook')}
                  <ArrowUpRight aria-hidden="true" size={iconSize.compact} />
                  <span className="su-sr-only"> {referenceCopy('opensInNewTab')}</span>
                </Button>
              )}
              {build && (
                // A link drawn as the shared Button (`Button href`): same tab, no
                // off-site arrow — the Reference and Build are one union
                // (ruleset §3.11).
                <Button
                  href={build.href}
                  aria-label={build.ariaLabel}
                  variant="primary"
                  size="compact"
                  className="su-page-action"
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
                <span className="su-sr-only">{referenceCopy('level')} </span>
                {meta.numeral}
              </>
            )
          }
        >
          {title}
          <KindLabel kind={meta.typeLabel} />
        </ChapterBand>
      </ReferenceSurface>
      <div className="su-entity__body su-page-body">
        {rail ? (
          <div className="su-entity__railed">
            <div className="su-entity__railed-main">{children}</div>
            {rail}
          </div>
        ) : (
          children
        )}
        {foot && (
          <ReferenceSurface>
            <div className="su-entity__foot">{foot}</div>
          </ReferenceSurface>
        )}
        {exits && <GuideExitsFoot {...exits} />}
        {mediator && <MediatorActsFoot {...mediator} />}
      </div>
    </article>
  )
}
