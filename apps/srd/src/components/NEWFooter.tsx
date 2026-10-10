import type { ChapterTone } from 'component-lib'
import { ChapterFoot } from 'component-lib'

/**
 * NEWFooter — the L2 footer refresh (component-refresh skill), built beside
 * `Footer` with no consumers: three variants for the owner to pick from in the
 * catalog (`NEWFooter.stories.tsx`). Nothing on the site renders it yet.
 *
 * What every variant keeps, and why:
 *
 * - **The licence's required legal text, verbatim.** Salvage Union Open Game
 *   Licence 1.0b, "Required Legal Text": licensees "must include the following
 *   legal text in their products". Board 06's one-line paraphrase ("…is
 *   copyright Leyline Press, used under…") drops the logo clause, so the band
 *   carries the two required sentences, set small, in one paragraph.
 * - **The artwork notice.** The OGL does not cover the art ("Use of any art …
 *   is not permitted"); the site's artwork is reproduced under a separate
 *   special permission, and this sentence is the site's statement of it.
 * - **The "Powered by Salvage" mark.** Optional under the licence ("Licensee
 *   may utilise…"), but the required text names it; 40px, square, with a 1:1
 *   `width`/`height` so nothing reflows when it loads.
 *
 * The legal sentences carry no links: a prose link must be an `InlineRef`,
 * which paints rust (ruleset §3.1), and the band has no action in it. The
 * licence is linked from `/about`. The site's own pages are chrome, not prose,
 * so they stay ink (or paper, on ink) and underlined.
 */

/** The site's own pages (ruleset §3.11): the Union bar dropped its second row. */
const SITE_LINKS = [
  { label: 'Changelog', href: '/changelog/' },
  { label: 'API', href: '/api/' },
  { label: 'Discord', href: '/discord/' },
  { label: 'About', href: '/about/' },
] as const

/** The SRD's widest measure, matching the Contents band at the page's head. */
const SITE_MEASURE = '85rem'

/** An entity page's measure (board 07; `ENTITY_PAGE_MEASURE`). */
const ENTITY_MEASURE = '75rem'

export type NEWFooterVariant = 'origin' | 'chapter' | 'ink'

/**
 * An entity page's citation, for the `chapter` variant: the page's chapter
 * tone and `resolveEntityPageMeta`'s `page` and `citation`. The page module
 * already has all three (`chapterForSchema`, `resolveEntityPageMeta`); at L3 it
 * would hand them to the layout with the rest of its `PageResult`.
 */
export type NEWFooterCitation = {
  tone: ChapterTone
  page?: number
  citation?: string
}

type NEWFooterProps = {
  /** A: the slim rules-blue band. B: A, or the chapter's foot on an entity page. C: an ink foot. */
  variant: NEWFooterVariant
  /** URL for the "Powered by Salvage" mark, from the consuming app's public dir. */
  poweredBySalvageUrl: string
  /** B only: the entity page's citation. Absent (home, listings) → the A band. */
  citation?: NEWFooterCitation
}

function Legal() {
  return (
    <p className="srd-footer-new__legal">
      Salvage Union is copyrighted by Leyline Press. Salvage Union and the “Powered by Salvage” logo
      are used with permission of Leyline Press, under the Salvage Union Open Game Licence 1.0b. All
      Workshop Manual Images are used with special permission from Leyline Press.
    </p>
  )
}

/** Ink on the light bands, paper on the dark ones: the links inherit the band's text colour. */
function SiteLinks() {
  return (
    <nav aria-label="Site">
      <ul className="srd-footer-new__links">
        {SITE_LINKS.map((link) => (
          <li key={link.href}>
            <a href={link.href} className="srd-footer-new__link">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Mark({ src, onInk }: { src: string; onInk: boolean }) {
  return (
    <img
      src={src}
      alt="Powered by Salvage"
      className={
        onInk ? 'srd-footer-new__mark srd-footer-new__mark--paper' : 'srd-footer-new__mark'
      }
      width={40}
      height={40}
    />
  )
}

function End({ src, onInk }: { src: string; onInk: boolean }) {
  return (
    <div className="srd-footer-new__end">
      <SiteLinks />
      <Mark src={src} onInk={onInk} />
    </div>
  )
}

export function NEWFooter({ variant, poweredBySalvageUrl, citation }: NEWFooterProps) {
  if (variant === 'ink') {
    return (
      <ChapterFoot
        as="footer"
        tone="ink"
        fill="var(--color-ink-deep)"
        measure={SITE_MEASURE}
        start={<Legal />}
        end={<End src={poweredBySalvageUrl} onInk />}
      />
    )
  }

  const cited = variant === 'chapter' && citation
  if (cited && (citation.page != null || citation.citation)) {
    // Board 07: the entity page closes on its chapter's foot band — the page
    // cite large, the book at the end — and the site's legal row follows in
    // the same tone, under the band's own ink rule, so the page ends once.
    const onInk = citation.tone === 'denizen' || citation.tone === 'crawler'
    return (
      <footer className="srd-footer-new">
        <ChapterFoot
          tone={citation.tone}
          measure={ENTITY_MEASURE}
          start={citation.page != null ? `p.${citation.page}` : undefined}
          end={citation.citation}
        />
        <ChapterFoot
          tone={citation.tone}
          measure={ENTITY_MEASURE}
          start={<Legal />}
          end={<End src={poweredBySalvageUrl} onInk={onInk} />}
        />
      </footer>
    )
  }

  return (
    <ChapterFoot
      as="footer"
      tone="rules"
      measure={SITE_MEASURE}
      start={<Legal />}
      end={<End src={poweredBySalvageUrl} onInk={false} />}
    />
  )
}
