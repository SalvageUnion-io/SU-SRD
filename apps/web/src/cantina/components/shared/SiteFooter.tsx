import type { CSSProperties } from 'react'
import { Footer, tokens } from '../../../ui/index'
import { publicPath } from '../../lib/appUrl'
import { DOC_PAGES } from '../../lib/docPages'

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

/** The SRD's own footer links, in its order (`apps/web/src/lib/constants.ts`). */
const LINKS = [DOC_PAGES.changelog, DOC_PAGES.api, DOC_PAGES.discord, DOC_PAGES.about]

/** Room between the page and its foot band, as the old hairline foot had. */
const GAP = { marginTop: tokens.space[48] } satisfies CSSProperties

/** The mark ships in the Cantina's own `public/`, under the base. */
const MARK = publicPath('Powered_by_Salvage_Black.webp')

export function SiteFooter() {
  return (
    <div style={GAP}>
      <Footer links={LINKS} poweredBySalvageUrl={MARK} />
    </div>
  )
}
