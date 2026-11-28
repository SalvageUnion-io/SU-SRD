import type { CSSProperties } from 'react'
import { SyncBadge } from '../../components/shared/SyncBadge'
import { useSync } from '../../replica/syncContext'
import { AppAccountMenu } from './AppAccountMenu'
import { SignInControl } from './SignInControl'

/**
 * What the app puts in the masthead's app slots (`UnionBarSlots`' `actions`,
 * `mobileActions` and `drawerExtra`) — the account, wired to the Worker here so
 * `src/components` stays persistence-agnostic. Your Games are a tab of their own
 * (ADR-066), so the bar carries no Games menu:
 *
 * | Where                      | Signed in                | Signed out           |
 * | -------------------------- | ------------------------ | -------------------- |
 * | desktop, at the bar's end  | name + avatar ▾          | Sign in with Discord |
 * | mobile header row          | avatar                   | —                    |
 * | mobile drawer, top         | —                        | Sign in with Discord |
 *
 * Mobile is split because the row beside the hamburger has room for one
 * avatar-sized control and no more. The avatar stays in the row so who is
 * signed in is visible on every screen.
 */

/** The avatar, the sync badge's dot pinned to its corner. */
const AVATAR = { display: 'inline-flex', position: 'relative' } satisfies CSSProperties

/** Desktop, at the bar's end: the sync badge and the account menu (or sign-in). */
export function HeaderActions() {
  const { status } = useSync()

  if (status === 'live' || status === 'offline') {
    return (
      <>
        <SyncBadge />
        <AppAccountMenu />
      </>
    )
  }
  return <SignInControl inBar returnHere />
}

/** Mobile header row: the avatar-only account menu, the sync badge a dot on it. Nothing when signed out. */
export function HeaderMobileActions() {
  const { status } = useSync()
  if (status !== 'live' && status !== 'offline') return null
  return (
    <span style={AVATAR}>
      <AppAccountMenu compact />
      <SyncBadge dot />
    </span>
  )
}

/** Mobile drawer: sign-in while nobody is signed in; signed in, the avatar is the account. */
export function HeaderDrawerAccount() {
  const { status } = useSync()
  if (status === 'live' || status === 'offline') return null
  return <SignInControl returnHere />
}
