import { unionHere } from '../../lib/barLinks'
import { useSync } from '../../replica/syncContext'
import { GamesDrawerList, GamesMenu } from '../entityContainer/GamesMenu'
import { AppAccountMenu } from './AppAccountMenu'
import { SignInControl } from './SignInControl'

/**
 * What the app puts in the masthead's app slots (`UnionBarSlots`' `games`,
 * `actions`, `mobileActions` and `drawerExtra`) — the account and the Games,
 * wired to Convex here so `src/components` stays persistence-agnostic.
 *
 * There is no sub-header: Games sits in Play's nav (Games · Solo; Build's,
 * Training Bay · Patterns · Starter Set, has none), and the account is the menu at
 * the bar's end:
 *
 * | Where                      | Signed in (Connected)    | Signed in (offline) | Signed out           |
 * | -------------------------- | ------------------------ | ------------------- | -------------------- |
 * | Play's desktop nav, first  | Games ▾                  | —                   | —                    |
 * | desktop, at the bar's end  | name + avatar ▾          | name + avatar ▾     | Sign in with Discord |
 * | mobile header row          | avatar                   | avatar              | —                    |
 * | mobile drawer, top         | Games list (in Play)     | —                   | Sign in with Discord |
 *
 * Mobile is split because the row beside the hamburger has room for one
 * avatar-sized control and no more: a "Games ▾" trigger or a "Sign in with
 * Discord" button beside it would crowd the switcher out of the bar. The avatar
 * stays in the row so who is signed in is visible on every screen; the rest
 * goes into the drawer.
 */

/** Play's desktop nav: the Games menu (renders nothing unless Connected), current on the hub and a Game's routes. */
export function HeaderGames({ pathname = '' }: { pathname?: string }) {
  return <GamesMenu active={unionHere(pathname).nav === 'games'} />
}

/** Desktop, at the bar's end: the account menu (or sign-in). */
export function HeaderActions() {
  const { status } = useSync()

  if (status === 'live' || status === 'offline') return <AppAccountMenu />
  return <SignInControl inBar />
}

/** Mobile header row: the avatar-only account menu. Nothing when signed out. */
export function HeaderMobileActions() {
  return <AppAccountMenu compact />
}

/**
 * Mobile drawer: in Play, the Games list when Connected (Play's nav, as the
 * bar's); sign-in when signed out, in either mode.
 */
export function HeaderDrawerAccount({
  close,
  pathname = '',
}: {
  close: () => void
  pathname?: string
}) {
  const { status } = useSync()
  if (status === 'live') {
    return unionHere(pathname).mode === 'play' ? <GamesDrawerList onPick={close} /> : null
  }
  // Offline: the avatar menu in the header row already offers Sign out, and
  // there is nothing to list.
  if (status === 'offline') return null
  return <SignInControl />
}
