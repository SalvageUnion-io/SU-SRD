import { SETTINGS_HREF, signOutHref } from '../../lib/accountBar'
import { readAccountHint } from '../../lib/accountHint'
import { browserStorage } from '../../lib/accountState'
import { DOC_PAGES } from '../../lib/docPages'
import { AccountMenu } from '../index'
import { IslandErrorBoundary } from './IslandErrorBoundary'

/**
 * The shared account menu in the SRD's Union bar, the one the app's bar
 * shows. Mounted only while somebody is signed in (`lib/accountBar.ts`); the
 * name and avatar are the account hint's. Settings and Sign out are
 * the app's: the SRD cannot touch the session.
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
        aboutHref={DOC_PAGES.about.href}
        changelogHref={DOC_PAGES.changelog.href}
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
