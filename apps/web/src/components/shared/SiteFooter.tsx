import type { CSSProperties } from 'react'
import { SITE_LINKS } from '../../lib/docPages'
import { Footer, tokens } from '../index'

/**
 * SiteFooter — the app's page foot: the shared `Footer` both tools end on, in
 * the colour of the page's leading band (ink where none leads), with the
 * licence row and the doc pages both tools share, which live on the SRD
 * (`docPages.ts`).
 *
 * It ends every page that draws the Union bar, signed in or out, at every
 * width. It sits in normal flow after the route, so nothing pinned can cover
 * it: the bars that stay in view (the sheet's control bar, the wizard's
 * next/back) are `sticky` inside their own screen and release before it. A
 * Play screen draws neither the bar nor this foot (`hidesUnionBar`): it fills
 * the viewport, and the page never scrolls.
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
