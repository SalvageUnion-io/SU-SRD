import { InlineRef } from 'component-lib'

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

export function Footer({ poweredBySalvageUrl }: FooterProps) {
  return (
    <footer className="border-t border-wk-faint bg-paper py-3 lg:shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 px-4 text-xs text-ink sm:flex-row sm:flex-wrap sm:gap-4">
        <div className="w-full min-w-0 text-center sm:w-auto sm:flex-1">
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
        <nav aria-label="Site" className="w-full shrink-0 sm:w-auto">
          <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-body text-sm">
            {SITE_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-ink underline underline-offset-2 hover:text-ink-75"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="inline-block shrink-0 rounded-md p-2">
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
            className="h-12 w-auto"
            width={48}
            height={48}
          />
        </div>
      </div>
    </footer>
  )
}
