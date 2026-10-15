import { SETTINGS_HREF, signOutHref } from '../../lib/accountBar'
import { browserStorage } from '../../lib/accountState'
import { readAccountHint } from '../../ui/accountHint'
import { AccountMenu } from '../../ui/index'
import { IslandErrorBoundary } from './IslandErrorBoundary'

/**
 * The shared account menu in the SRD's Union bar, the one The Cantina's bar
 * shows. Mounted only while somebody is signed in (`lib/accountBar.ts`); the
 * name and avatar are the account hint's. Settings and Sign out are
 * The Cantina's: the SRD cannot touch the session.
 */
function AccountIslandBody({ compact }: { compact: boolean }) {
  const hint = readAccountHint(browserStorage())
  if (hint === null) return null
  return (
    <IslandErrorBoundary>
      <AccountMenu
        name={hint.name}
        avatarUrl={hint.avatarUrl}
        compact={compact}
        onSettings={() => window.location.assign(SETTINGS_HREF)}
        onSignOut={() => window.location.assign(signOutHref(window.location.href))}
        aboutHref="/about/"
        changelogHref="/changelog/"
      />
    </IslandErrorBoundary>
  )
}

/** At the bar's end on a desktop: avatar and name. */
export function AccountIsland() {
  return <AccountIslandBody compact={false} />
}

/**
 * In the phone's header row, beside the hamburger: the avatar alone. Its own
 * island rather than a `compact` prop, because chrome takes no props: a prop
 * here would put a props script on every page.
 */
export function AccountAvatarIsland() {
  return <AccountIslandBody compact />
}
