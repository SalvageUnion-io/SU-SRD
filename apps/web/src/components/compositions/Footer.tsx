import type { ElementType } from 'react'
import { citeLine } from 'salvageunion-reference'
import { ChapterFoot } from '../atoms/ChapterFoot'
import { FOCUS_RING } from '../atoms/interaction'

/**
 * Footer — where every page of both tools ends, as the Workshop Manual's pages
 * do (one product, so one foot): ONE band in the colour of the band the page
 * leads with, as the Union bar wears it (`footerMatchCss`), ink with paper
 * flecks on a page that leads with none.
 *
 * - **A show page** (entity, pattern, roll table) merges its entity
 *   foot into it: the citation on one line, the book first and each reprint
 *   after a `//` (`Workshop Manual · p.65 // … (CR) · p.37`, `citeLine`), in
 *   the same words a card's foot cites it, text, never chips, and no kind
 *   (ruleset Source 2, E9). It has no ink rule: the band's colour runs edge
 *   to edge. A player-made page (a saved pattern) puts its `credit` there
 *   instead: "Homebrew // Made by alxjrvs".
 * - **Every page** carries the licence's required legal text, the tool's own
 *   pages (`links`, through `LinkComponent`) and the "Powered by Salvage"
 *   mark, reversed to paper on a ground that prints paper.
 */

/** One printing a book page cites: the book (and booklet), and its page. */
type FooterPrinting = { book: string; page?: number }

/** A show page's foot: its printings, cited in the footer, and the page measure. */
export type FooterFoot = {
  /** Where it is printed: the book first, then each reprint. */
  printings?: readonly FooterPrinting[]
  /**
   * A player-made page's credit, in the place the printings take (ruleset
   * §3.9): "Homebrew // Made by alxjrvs". It has no page in any book to cite,
   * so it replaces them.
   */
  credit?: string
  /** The inner row's max width, matching the page's own measure. */
  measure?: string
}

type FooterLink = { label: string; href: string }

type FooterProps = {
  /** The tool's own pages, same tab, underlined in the band's ink (or paper). */
  links: readonly FooterLink[]
  /** URL for the "Powered by Salvage" mark, from the app's public dir. */
  poweredBySalvageUrl: string
  /** A show page's foot. Absent, or with no printings → the licence row alone. */
  foot?: FooterFoot
  /** Link component for the tool's pages. Defaults to a plain anchor. */
  LinkComponent?: ElementType
}

/** The measure when the host passes none: the app's (the SRD passes its page measure). */
const SITE_MEASURE = '85rem'

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
  LinkComponent,
}: {
  links: readonly FooterLink[]
  src: string
  LinkComponent: ElementType
}) {
  return (
    <div className="su-footer__end">
      <nav aria-label="Site">
        <ul className="su-footer__links">
          {links.map((link) => (
            <li key={link.href}>
              <LinkComponent href={link.href} className={`su-footer__link ${FOCUS_RING}`}>
                {link.label}
              </LinkComponent>
            </li>
          ))}
        </ul>
      </nav>
      {/*
        Square, 40px, with its box declared 1:1 so nothing reflows as it loads:
        a wrong `width`/`height` ratio causes the very shift it exists to
        prevent. The source is 192px (4x DPR headroom). On a ground that
        prints paper the black mark reverses to paper, as Leyline's white one
        is (`--su-foot-mark`).
      */}
      <img
        src={src}
        alt="Powered by Salvage"
        className="su-footer__mark"
        width={40}
        height={40}
        // Below the fold on every page. Lazy also stops React's SSR from
        // hoisting a `<link rel="preload">` for it into every reference page's `<head>`,
        // where it competed with the fonts and the hero art.
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}

export function Footer({ links, poweredBySalvageUrl, foot, LinkComponent = 'a' }: FooterProps) {
  const measure = foot?.measure ?? SITE_MEASURE
  const citation = foot?.credit ?? citeLine(foot?.printings ?? [])
  return (
    <footer className="su-footer">
      <ChapterFoot
        measure={measure}
        cite={citation ? <p className="su-footer__citation">{citation}</p> : undefined}
        start={<Legal />}
        end={<End links={links} src={poweredBySalvageUrl} LinkComponent={LinkComponent} />}
      />
    </footer>
  )
}
