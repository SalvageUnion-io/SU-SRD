import { Link } from '@tanstack/react-router'
import { FOCUS_RING } from 'component-lib'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { SignInControl } from './SignInControl'

/**
 * The account cluster — sign-in plus links to Games and the account page.
 *
 * ## Where it renders
 *
 * It is handed to `AppHeader` as its `utilityRow` slot, so it sits on its own
 * row *inside* the dark masthead, beneath the nav. It used to be a light strip
 * stacked above the header, which read as a second bar competing with the
 * brand. Living on the masthead means these are paper-on-ink controls, not the
 * ink-on-paper ones the old strip used.
 *
 * ## Why not nav items in `AppBar`
 *
 * `AppBar` lives in `component-lib` and is shared with `apps/srd`, which has no
 * accounts and never will. Threading auth through `navItems` would push an
 * ITUN-only concept into a package whose contract is to stay backend-agnostic.
 * A generic slot keeps the blast radius inside ITUN.
 *
 * ## It renders nothing in a Solo build
 *
 * No `VITE_CONVEX_URL` means accounts are not merely signed-out, they are
 * absent — so there is nothing to link to and nothing to sign into. Existing
 * users see exactly the chrome they saw before.
 */

// The masthead nav-link treatment one size down — same paper-on-ink ramp and
// the same rust focus ring its siblings in `AppBar` use, so the utility row
// reads as part of the bar rather than as a transplanted light-mode strip.
const ACCOUNT_LINK = `font-cond text-caption font-semibold uppercase tracking-caps-wide text-paper/60 no-underline transition-colors hover:text-paper ${FOCUS_RING}`

export function AccountStrip() {
  const { mode } = useConnection()
  if (!isConvexConfigured) return null

  return (
    <div className="flex items-center justify-end gap-3">
      {mode === 'connected' && (
        <Link to="/games" className={ACCOUNT_LINK}>
          Games
        </Link>
      )}
      {mode === 'connected' && (
        <Link to="/account" className={ACCOUNT_LINK}>
          Account
        </Link>
      )}
      <SignInControl onDark />
    </div>
  )
}
