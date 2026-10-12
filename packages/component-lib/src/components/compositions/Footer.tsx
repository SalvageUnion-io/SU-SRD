import type { ElementType } from 'react'
import { foregroundOn } from '../../design/contrast'
import { ChapterFoot } from '../atoms/ChapterFoot'
import type { ChapterTone } from '../atoms/chapterBandColor'

/**
 * Footer — where every page of both tools ends, as the Workshop Manual's pages
 * do (refit S2: one product, so one foot; hoisted from the SRD's site footer).
 *
 * - **A book page** (entity, pattern, roll table; board 07) ends on its
 *   chapter's foot band: the page cite set large and the book at the end, then
 *   the licence row in the same tone under the band's ink rule. One band, so
 *   the page does not close twice.
 * - **A schema listing** ends on its chapter's band too, with the licence row
 *   alone: it cites no page.
 * - **Every other page** (the SRD's home, guides, about; board 06, and every
 *   ITUN page) ends on the slim rules-blue band of the Contents chapter.
 *
 * The licence row is the same in both tools: the licence's required legal
 * text, the tool's own pages (`links`, through `LinkComponent`), and the
 * "Powered by Salvage" mark.
 */

/** A page's foot: its chapter tone and citation (a listing: the tone alone). */
export type FooterFoot = {
  tone: ChapterTone
  /** The band colour when the page wears its own rather than its chapter's. */
  fill?: string
  /** The page number the citation leads with (`p.112`). */
  page?: number
  /** The book, then any reprints. */
  citation?: string
  /** The inner row's max width, matching the page's own measure. */
  measure?: string
}

export type FooterLink = { label: string; href: string }

type FooterProps = {
  /** The tool's own pages, same tab, underlined in the band's ink (or paper). */
  links: readonly FooterLink[]
  /** URL for the "Powered by Salvage" mark, from the app's public dir. */
  poweredBySalvageUrl: string
  /** A book page's foot. Absent → the rules-blue band. */
  foot?: FooterFoot
  /** Link component for the tool's pages. Defaults to a plain anchor. */
  LinkComponent?: ElementType
}

/** The SRD's widest measure, matching the Contents band at the page's head. */
const SITE_MEASURE = '85rem'

/** The chapter bands that carry paper text (ruleset §3.8), where the mark reverses too. */
const PAPER_ON = new Set<ChapterTone>(['denizen', 'crawler', 'ink'])

/**
 * The licence's required legal text, word for word (Salvage Union Open Game
 * Licence 1.0b, "Required Legal Text": licensees "must include the following
 * legal text in their products"), and the artwork notice: the OGL does not
 * cover the art, which both tools reproduce under a separate special permission.
 *
 * No links: a prose link must be an `InlineRef`, which paints rust (ruleset
 * §3.1), and the band holds no action. The About pages link the licence.
 */
function Legal() {
  return (
    <p className="su-footer__legal">
      Salvage Union is copyrighted by Leyline Press. Salvage Union and the “Powered by Salvage” logo
      are used with permission of Leyline Press, under the Salvage Union Open Game Licence 1.0b. All
      Workshop Manual Images are used with special permission from Leyline Press.
    </p>
  )
}

function End({
  links,
  src,
  onPaper,
  LinkComponent,
}: {
  links: readonly FooterLink[]
  src: string
  onPaper: boolean
  LinkComponent: ElementType
}) {
  return (
    <div className="su-footer__end">
      <nav aria-label="Site">
        <ul className="su-footer__links">
          {links.map((link) => (
            <li key={link.href}>
              <LinkComponent href={link.href} className="su-footer__link">
                {link.label}
              </LinkComponent>
            </li>
          ))}
        </ul>
      </nav>
      {/*
        Square, 40px, with its box declared 1:1 so nothing reflows as it loads:
        a wrong `width`/`height` ratio causes the very shift it exists to
        prevent. The source is 192px (4x DPR headroom). On a band that carries
        paper text the black mark reverses to paper, as Leyline's white one is.
      */}
      <img
        src={src}
        alt="Powered by Salvage"
        className={onPaper ? 'su-footer__mark su-footer__mark--paper' : 'su-footer__mark'}
        width={40}
        height={40}
      />
    </div>
  )
}

export function Footer({ links, poweredBySalvageUrl, foot, LinkComponent = 'a' }: FooterProps) {
  const tone = foot?.tone ?? 'rules'
  const fill = foot?.fill
  const onPaper = fill ? foregroundOn(fill, 'ink') === 'paper' : PAPER_ON.has(tone)
  const measure = foot?.measure ?? SITE_MEASURE
  const cited = foot != null && (foot.page != null || !!foot.citation)
  return (
    <footer className="su-footer">
      {cited && (
        <ChapterFoot
          tone={tone}
          fill={fill}
          measure={measure}
          start={foot.page != null ? `p.${foot.page}` : undefined}
          end={foot.citation}
        />
      )}
      <ChapterFoot
        tone={tone}
        fill={fill}
        measure={measure}
        start={<Legal />}
        end={
          <End
            links={links}
            src={poweredBySalvageUrl}
            onPaper={onPaper}
            LinkComponent={LinkComponent}
          />
        }
      />
    </footer>
  )
}
