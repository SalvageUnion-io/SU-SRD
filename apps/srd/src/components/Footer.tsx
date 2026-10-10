import { ChapterFoot, InlineRef } from 'component-lib'

/**
 * The site's own pages, which left the Union bar when the SRD dropped its second
 * nav row (ruleset §3.11, canvas v60): the bar carries the switcher, the search
 * and the trail, and these four live down here, ink and underlined.
 */
const SITE_LINKS = [
  { label: 'Changelog', href: '/changelog/' },
  { label: 'API', href: '/api/' },
  { label: 'Discord', href: '/discord/' },
  { label: 'About', href: '/about/' },
] as const

type FooterProps = {
  /** URL for the "Powered by Salvage" logo image — passed by consuming app */
  poweredBySalvageUrl: string
}

/**
 * The site footer: the Contents chapter's foot band (board 06) — the rules
 * blue with its ink speckle under an ink rule, the licence and attribution at
 * its start, the site's pages and the "Powered by Salvage" mark at its end.
 */
export function Footer({ poweredBySalvageUrl }: FooterProps) {
  return (
    <ChapterFoot
      as="footer"
      tone="rules"
      measure="85rem"
      start={
        <div className="srd-footer__legal">
          <p>
            Salvage Union is copyrighted by{' '}
            <InlineRef href="https://leyline.press" target="_blank" rel="noopener noreferrer">
              Leyline Press
            </InlineRef>
            .
          </p>
          <p>
            Salvage Union and the &quot;Powered by Salvage&quot; logo are used with permission of
            Leyline Press, under the{' '}
            <InlineRef
              href="https://leyline.press/pages/salvage-union-open-game-licence-1-0b"
              target="_blank"
              rel="noopener noreferrer"
            >
              Salvage Union Open Game Licence 1.0b
            </InlineRef>
            .
          </p>
          <p>
            All Workshop Manual Images are used with special permission from{' '}
            <InlineRef href="https://leyline.press" target="_blank" rel="noopener noreferrer">
              Leyline Press
            </InlineRef>
            .
          </p>
        </div>
      }
      end={
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
            48x48, matching the source's 1:1 ratio.

            It said 120x48 — a 2.5:1 ratio against an image that is square. With
            `h-12 w-auto` the browser reserves space from the DECLARED ratio and
            then corrects to the intrinsic one once the bytes land, so the
            footer reflowed on every page load. Wrong `width`/`height` is worse
            than none: it actively causes the shift the attributes exist to
            prevent.

            The source was also 1055x1053 for this 48px slot — a ~22x linear
            oversample, and 109 KB against ~23 KB for the whole rest of an
            entity page. It is 192px now (4x DPR headroom), 16 KB, on all 1,036
            pages. The master is in git history.
          */}
          <img
            src={poweredBySalvageUrl}
            alt="Powered by Salvage"
            className="srd-footer__mark"
            width={48}
            height={48}
          />
        </div>
      }
    />
  )
}
