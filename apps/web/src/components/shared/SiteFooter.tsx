import type { CSSProperties } from 'react'
import { SITE_LINKS } from '../../lib/docPages'
import { Footer, tokens } from '../index'

/**
 * SiteFooter — the Cantina's page foot: the shared `Footer` both tools end on, here
 * on the rules-blue band with the licence row and the doc pages both tools
 * share, which live on the SRD (`docPages.ts`).
 *
 * It ends every page, signed in or out, at every width. It sits in
 * normal flow after the route, so nothing pinned can cover it: the bars that
 * stay in view (the sheet's control bar, the wizard's next/back, the phone
 * Dashboard's menu and resolve bar) are `sticky` inside their own screen and
 * release before it, and the canvas Dashboard and the Mediator fill the
 * viewport, so the page scrolls on to it.
 */

/** Room between the page and its foot band, as the old hairline foot had. */
const GAP = { marginTop: tokens.space[48] } satisfies CSSProperties

/** srd's `public/` file, at the site's root. */
const MARK = '/Powered_by_Salvage_Black.webp'

export function SiteFooter() {
  return (
    <div style={GAP}>
      <Footer links={SITE_LINKS} poweredBySalvageUrl={MARK} />
    </div>
  )
}
