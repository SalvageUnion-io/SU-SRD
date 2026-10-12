import { Footer, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { useConnection } from '../../lib/connection/connectionContext'
import { AppLink } from './AppLink'

/**
 * SiteFooter — ITUN's page foot: the shared `Footer` both tools end on (refit
 * S2), on the rules-blue band with the licence row and ITUN's About and
 * Changelog.
 *
 * Those two live at the drawer's foot (issue 1255) and, signed in, in the
 * account menu. From `lg` up the drawer is gone, and signed out there is no
 * account menu, so without this a desktop visitor could reach neither. The
 * bar never carries them (board 09), so they sit at the page's foot instead.
 * Phones have the drawer, and a signed-in desktop the account menu, so this
 * renders nothing there.
 */

const LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Changelog', href: '/changelog' },
] as const

/** Room between the page and its foot band, as the old hairline foot had. */
const GAP = { marginTop: tokens.space[48] } satisfies CSSProperties

/** The mark ships in ITUN's own `public/`, under whatever base the build has. */
const MARK = `${import.meta.env.BASE_URL ?? '/'}Powered_by_Salvage_Black.webp`

export function SiteFooter() {
  const { mode } = useConnection()
  const desktop = useIsDesktop()
  // The account menu carries both while signed in (online or not).
  if (!desktop || mode === 'connected' || mode === 'disconnected') return null
  return (
    <div style={GAP}>
      <Footer links={LINKS} poweredBySalvageUrl={MARK} LinkComponent={AppLink} />
    </div>
  )
}
