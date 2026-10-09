import { useConnection } from '../../lib/connection/connectionContext'
import { GamesDrawerList, GamesMenu } from '../container/GamesMenu'
import { AccountMenu } from './AccountMenu'
import { SignInControl } from './SignInControl'

/**
 * What ITUN puts in the masthead's three app slots (`AppHeader`'s `actions`,
 * `mobileActions` and `drawerExtra`) — the account and the Games, wired to
 * Convex here so `component-lib` stays persistence-agnostic.
 *
 * There is no sub-header any more. Games, Account and Sign out used to sit on
 * a second row under the nav (`AccountStrip`); they are now two menus on the
 * nav's own row:
 *
 * | Where                      | Signed in (Connected)    | Signed in (offline) | Signed out           |
 * | -------------------------- | ------------------------ | ------------------- | -------------------- |
 * | desktop, after "Buy"       | Games ▾ · name + avatar ▾ | name + avatar ▾     | Sign in with Discord |
 * | mobile header row          | avatar                   | avatar              | —                    |
 * | mobile drawer, top         | Games list               | —                   | Sign in with Discord |
 *
 * Mobile is split because the row beside the hamburger has room for one
 * avatar-sized control and no more: the brand already wraps there, and a
 * "Games ▾" trigger or a "Sign in with Discord" button beside it pushed the
 * wordmark onto three lines. The avatar stays in the row so who is signed in
 * is visible on every screen; the rest goes into the drawer.
 */

/** Desktop: the Games menu, then the account menu (or sign-in). */
export function HeaderActions() {
  const { mode } = useConnection()

  if (mode === 'connected' || mode === 'disconnected') {
    return (
      <>
        {/* GamesMenu renders nothing unless Connected. */}
        <GamesMenu />
        <AccountMenu />
      </>
    )
  }
  return <SignInControl onDark />
}

/** Mobile header row: the avatar-only account menu. Nothing when signed out. */
export function HeaderMobileActions() {
  return <AccountMenu compact />
}

/** Mobile drawer: the Games list when Connected, sign-in when signed out. */
export function HeaderDrawerAccount({ close }: { close: () => void }) {
  const { mode } = useConnection()
  if (mode === 'connected') return <GamesDrawerList onPick={close} />
  // Offline: the avatar menu in the header row already offers Sign out, and
  // there is nothing to list.
  if (mode === 'disconnected') return null
  return <SignInControl />
}
