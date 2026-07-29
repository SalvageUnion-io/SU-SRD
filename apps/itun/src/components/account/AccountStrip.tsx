import { Link } from '@tanstack/react-router'

import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { SignInControl } from './SignInControl'

/**
 * A thin strip above the brand header carrying sign-in and a link to the
 * account page.
 *
 * ## Why not a nav item in `AppBar`
 *
 * `AppBar` lives in `component-lib` and is shared with `apps/srd`, which has no
 * accounts and never will. Threading an auth slot through it would push an
 * ITUN-only concept into a package whose contract is to stay backend-agnostic,
 * and would touch a component every page of both apps renders. A local strip
 * keeps the blast radius inside ITUN.
 *
 * ## It renders nothing in a Solo build
 *
 * No `VITE_CONVEX_URL` means accounts are not merely signed-out, they are
 * absent — so there is nothing to link to and nothing to sign into. Existing
 * users see exactly the chrome they saw before.
 */
export function AccountStrip() {
  const { mode } = useConnection()
  if (!isConvexConfigured) return null

  return (
    <div className="flex items-center justify-end gap-3 border-b border-[var(--color-ink)]/15 px-3 py-1">
      {mode === 'connected' && (
        <Link
          to="/games"
          className="font-cond text-xs font-bold tracking-widest text-[var(--color-ink)] uppercase hover:text-[var(--color-rust)]"
        >
          Games
        </Link>
      )}
      {mode === 'connected' && (
        <Link
          to="/account"
          className="font-cond text-xs font-bold tracking-widest text-[var(--color-ink)] uppercase hover:text-[var(--color-rust)]"
        >
          Account
        </Link>
      )}
      <SignInControl />
    </div>
  )
}
