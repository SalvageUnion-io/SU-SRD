import { useConnection } from '../../lib/connection/connectionContext'
import { GamesDrawerList, GamesMenu } from '../container/GamesMenu'
import { AccountMenu } from './AccountMenu'
import { SignInControl } from './SignInControl'

/**
 * What ITUN puts in the masthead's app slots (`AppHeader`'s `games`,
 * `actions`, `mobileActions` and `drawerExtra`) — the account and the Games,
 * wired to Convex here so `component-lib` stays persistence-agnostic.
 *
 * There is no sub-header: Games sits in the Union bar's nav (Shelves · Games ·
 * Starter Set), and the account is the menu at the bar's end:
 *
 * | Where                      | Signed in (Connected)    | Signed in (offline) | Signed out           |
 * | -------------------------- | ------------------------ | ------------------- | -------------------- |
 * | desktop nav, after Shelves | Games ▾                  | —                   | —                    |
 * | desktop, at the bar's end  | name + avatar ▾          | name + avatar ▾     | Sign in with Discord |
 * | mobile header row          | avatar                   | avatar              | —                    |
 * | mobile drawer, top         | Games list               | —                   | Sign in with Discord |
 *
 * Mobile is split because the row beside the hamburger has room for one
 * avatar-sized control and no more: a "Games ▾" trigger or a "Sign in with
 * Discord" button beside it would crowd the switcher out of the bar. The avatar
 * stays in the row so who is signed in is visible on every screen; the rest
 * goes into the drawer.
 */

/** Desktop nav: the Games menu (renders nothing unless Connected). */
export function HeaderGames({ pathname = '' }: { pathname?: string }) {
  return <GamesMenu active={pathname.startsWith('/games')} />
}

/** Desktop, at the bar's end: the account menu (or sign-in). */
export function HeaderActions() {
  const { mode } = useConnection()

  if (mode === 'connected' || mode === 'disconnected') return <AccountMenu />
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
