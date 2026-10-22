import type { CSSProperties } from 'react'
import { compositionsCopy } from '../../messages/components-compositions'
import { Avatar } from '../atoms/Avatar'
import { HeaderMenu } from '../containers/HeaderMenu'

/**
 * AccountMenu — who is signed in, at the Union bar's end, the same on both
 * tools: the app's bar and the SRD's.
 *
 * The trigger shows the player's display name beside their Discord avatar on
 * a square chip (two initials when there is no avatar, or it will not load); it
 * opens a `HeaderMenu` holding **Settings** and **Sign out**, then **About** and
 * **Changelog**. The `compact` form is the avatar alone, for the phone's header
 * row, which has no room for a name.
 *
 * Presentational: each app hands in the identity and what the rows do. The
 * App reads `api.account.me` and signs out in place; the SRD, which has no
 * backend, reads the account hint (`src/lib/accountHint`) and sends
 * Settings and Sign out to the app. With no name yet (a cold start offline)
 * the trigger reads "Account" over a generic glyph rather than guessing.
 */

type AccountMenuProps = {
  /** The player's display name; null while it is unknown. */
  name: string | null
  avatarUrl: string | null
  /** Avatar only — the phone's header row. */
  compact?: boolean
  onSettings: () => void
  onSignOut: () => void
  /** The shared doc pages, on the SRD. */
  aboutHref: string
  changelogHref: string
}

// A name is identity, not chrome: it keeps the case the player typed, inside a
// trigger that otherwise wears the masthead's caps. Truncated so a long one
// cannot push the nav into the brand.
const NAME = {
  maxWidth: '12em',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textTransform: 'none',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

export function AccountMenu({
  name,
  avatarUrl,
  compact = false,
  onSettings,
  onSignOut,
  aboutHref,
  changelogHref,
}: AccountMenuProps) {
  return (
    <HeaderMenu
      label={
        name === null
          ? compositionsCopy('accountMenu')
          : compositionsCopy('accountMenuFor', { name })
      }
      chevron={!compact}
      trigger={
        <>
          <Avatar src={avatarUrl} name={name ?? ''} size={compact ? 32 : 28} />
          {!compact && <span style={NAME}>{name ?? compositionsCopy('account')}</span>}
        </>
      }
      sections={[
        [
          { id: 'settings', label: compositionsCopy('settings'), onSelect: onSettings },
          { id: 'sign-out', label: compositionsCopy('signOut'), onSelect: onSignOut },
        ],
        [
          {
            id: 'about',
            label: compositionsCopy('about'),
            onSelect: () => window.location.assign(aboutHref),
          },
          {
            id: 'changelog',
            label: compositionsCopy('changelog'),
            onSelect: () => window.location.assign(changelogHref),
          },
        ],
      ]}
    />
  )
}
