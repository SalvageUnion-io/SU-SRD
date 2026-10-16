import type { ElementType } from 'react'
import { color } from '../../design/tokens'
import { ChapterFoot } from '../atoms/ChapterFoot'
import type { ChapterTone } from '../atoms/chapterBandColor'

/**
 * Footer — where every page of both tools ends, as the Workshop Manual's pages
 * do (one product, so one foot).
 *
 * - **A book page** (entity, pattern, roll table; board 07) ends on its
 *   chapter's foot band: the entity's kind at the start, and where it is
 *   printed at the end, in the same words a card's footer cites it
 *   (`Workshop Manual · p.112`, then "Also in" any reprint) — one citation
 *   look everywhere, text, never chips (owner, 2026-10-14).
 * - **Every page**, a book page's under that band, ends on the licence row in
 *   the Union bar's ink (`AppBar`): one colour on every page of both tools, so
 *   the site's head and foot match whatever chapter lies between them.
 *
 * The licence row is the same in both tools: the licence's required legal
 * text, the tool's own pages (`links`, through `LinkComponent`), and the
 * "Powered by Salvage" mark, reversed to paper on the ink.
 */

/** One printing a book page cites: the book (and booklet), and its page. */
type FooterPrinting = { book: string; page?: number }

/** A book page's foot: its chapter tone, kind and printings, banded above the licence row. */
export type FooterFoot = {
  tone: ChapterTone
  /** The band colour when the page wears its own rather than its chapter's. */
  fill?: string
  /** The entity's kind ("System"), at the band's start. */
  kind?: string
  /** Where it is printed: the book first, then each reprint. */
  printings?: readonly FooterPrinting[]
  /** The inner row's max width, matching the page's own measure. */
  measure?: string
}

type FooterLink = { label: string; href: string }

type FooterProps = {
  /** The tool's own pages, same tab, underlined in the band's ink (or paper). */
  links: readonly FooterLink[]
  /** URL for the "Powered by Salvage" mark, from the app's public dir. */
  poweredBySalvageUrl: string
  /** A book page's foot. Absent → the licence row alone. */
  foot?: FooterFoot
  /** Link component for the tool's pages. Defaults to a plain anchor. */
  LinkComponent?: ElementType
}

/** The measure when the host passes none: The Cantina's (the SRD passes its page measure). */
const SITE_MEASURE = '85rem'

/** The licence row's band: the Union bar's own ink, paper text and paper flecks. */
const SITE_FILL = color.inkDeep

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

/** One printing as a card's footer cites it: `Workshop Manual · p.112`. */
const cite = ({ book, page }: FooterPrinting) => (page != null ? `${book} · p.${page}` : book)

/**
 * A book page's printings as the card footer prints them: the book first, then
 * an "Also in" line for the reprints.
 */
function Printings({ printings }: { printings: readonly FooterPrinting[] }) {
  const [first, ...reprints] = printings
  return (
    <div className="su-footer__printings">
      {first && <p>{cite(first)}</p>}
      {reprints.length > 0 && (
        <p>
          <span className="su-footer__also">Also in</span> {reprints.map(cite).join(', ')}
        </p>
      )}
    </div>
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
        prevent. The source is 192px (4x DPR headroom). On the ink band the
        black mark reverses to paper, as Leyline's white one is.
      */}
      <img
        src={src}
        alt="Powered by Salvage"
        className="su-footer__mark su-footer__mark--paper"
        width={40}
        height={40}
        // Below the fold on every page. Lazy also stops React's SSR from
        // hoisting a `<link rel="preload">` for it into every srd `<head>`,
        // where it competed with the fonts and the hero art.
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}

export function Footer({ links, poweredBySalvageUrl, foot, LinkComponent = 'a' }: FooterProps) {
  const measure = foot?.measure ?? SITE_MEASURE
  const printings = foot?.printings ?? []
  const cited = foot != null && (!!foot.kind || printings.length > 0)
  return (
    <footer className="su-footer">
      {cited && (
        <div className="su-footer__cite">
          <ChapterFoot
            tone={foot.tone}
            fill={foot.fill}
            measure={measure}
            start={foot.kind ? <span className="su-footer__kind">{foot.kind}</span> : undefined}
            end={printings.length > 0 ? <Printings printings={printings} /> : undefined}
          />
        </div>
      )}
      {/* On a phone a cited page's licence row starts below the first screen
          (`.su-footer__licence`), so the cite band ends it. */}
      <div className="su-footer__licence">
        <ChapterFoot
          fill={SITE_FILL}
          grain="paper"
          measure={measure}
          start={<Legal />}
          end={<End links={links} src={poweredBySalvageUrl} LinkComponent={LinkComponent} />}
        />
      </div>
    </footer>
  )
}
