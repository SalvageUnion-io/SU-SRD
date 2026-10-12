import { Footer, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { publicPath } from '../../lib/appUrl'
import { AppLink } from './AppLink'

/**
 * SiteFooter — ITUN's page foot: the shared `Footer` both tools end on, here
 * on the rules-blue band with the licence row and ITUN's About and Changelog.
 *
 * It ends every page, signed in or out, at every width. It sits in
 * normal flow after the route, so nothing pinned can cover it: the bars that
 * stay in view (the sheet's control bar, the wizard's next/back, the phone
 * Dashboard's menu and resolve bar) are `sticky` inside their own screen and
 * release before it, and the canvas Dashboard and the Mediator fill the
 * viewport, so the page scrolls on to it.
 */

const LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Changelog', href: '/changelog' },
] as const

/** Room between the page and its foot band, as the old hairline foot had. */
const GAP = { marginTop: tokens.space[48] } satisfies CSSProperties

/** The mark ships in ITUN's own `public/`, under the base. */
const MARK = publicPath('Powered_by_Salvage_Black.webp')

export function SiteFooter() {
  return (
    <div style={GAP}>
      <Footer links={LINKS} poweredBySalvageUrl={MARK} LinkComponent={AppLink} />
    </div>
  )
}
