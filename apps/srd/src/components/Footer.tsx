import { ChapterFoot } from 'component-lib'
import type { PageFoot } from '../../ssg/types'

/**
 * The site's own pages, which left the Union bar when the SRD dropped its second
 * nav row (ruleset §3.11, origin v60): the bar carries the switcher, the search
 * and the trail, and these four live down here, underlined in the band's ink
 * (or paper, on a dark band).
 */
const SITE_LINKS = [
  { label: 'Changelog', href: '/changelog/' },
  { label: 'API', href: '/api/' },
  { label: 'Discord', href: '/discord/' },
  { label: 'About', href: '/about/' },
] as const

/** The SRD's widest measure, matching the Contents band at the page's head. */
const SITE_MEASURE = '85rem'

/** The chapter bands that carry paper text (ruleset §3.8), where the mark reverses too. */
const PAPER_ON = new Set<PageFoot['tone']>(['denizen', 'crawler', 'ink'])

type FooterProps = {
  /** URL for the "Powered by Salvage" mark, from the app's public dir. */
  poweredBySalvageUrl: string
  /** A book page's foot: its chapter tone and citation. Absent → the rules-blue band. */
  foot?: PageFoot
}

/**
 * The licence's required legal text, word for word (Salvage Union Open Game
 * Licence 1.0b, "Required Legal Text": licensees "must include the following
 * legal text in their products"), and the artwork notice: the OGL does not
 * cover the art, which the site reproduces under a separate special permission.
 *
 * No links: a prose link must be an `InlineRef`, which paints rust (ruleset
 * §3.1), and the band holds no action. `/about` links the licence.
 */
function Legal() {
  return (
    <p className="srd-footer__legal">
      Salvage Union is copyrighted by Leyline Press. Salvage Union and the “Powered by Salvage” logo
      are used with permission of Leyline Press, under the Salvage Union Open Game Licence 1.0b. All
      Workshop Manual Images are used with special permission from Leyline Press.
    </p>
  )
}

function End({ src, onPaper }: { src: string; onPaper: boolean }) {
  return (
    <div className="srd-footer__end">
      <nav aria-label="Site">
        <ul className="srd-footer__links">
          {SITE_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="srd-footer__link">
                {link.label}
              </a>
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
        className={onPaper ? 'srd-footer__mark srd-footer__mark--paper' : 'srd-footer__mark'}
        width={40}
        height={40}
      />
    </div>
  )
}

/**
 * The site footer: where every page ends, as the Workshop Manual's pages do.
 *
 * - **A book page** (entity, pattern, roll table; board 07) ends on its
 *   chapter's foot band: the page cite set large and the book at the end, then
 *   the licence row in the same tone under the band's ink rule. One band, so
 *   the page does not close twice.
 * - **Every other page** (home, listings, guides, about; board 06) ends on the
 *   slim rules-blue band of the Contents chapter.
 */
export function Footer({ poweredBySalvageUrl, foot }: FooterProps) {
  const tone = foot?.tone ?? 'rules'
  const measure = foot?.measure ?? SITE_MEASURE
  const cited = foot != null && (foot.page != null || !!foot.citation)
  return (
    <footer className="srd-footer">
      {cited && (
        <ChapterFoot
          tone={tone}
          measure={measure}
          start={foot.page != null ? `p.${foot.page}` : undefined}
          end={foot.citation}
        />
      )}
      <ChapterFoot
        tone={tone}
        measure={measure}
        start={<Legal />}
        end={<End src={poweredBySalvageUrl} onPaper={PAPER_ON.has(tone)} />}
      />
    </footer>
  )
}
