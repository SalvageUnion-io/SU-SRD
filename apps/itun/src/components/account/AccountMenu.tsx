import { useNavigate } from '@tanstack/react-router'
import { Avatar } from 'component-lib'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { HeaderMenu } from '../shared/HeaderMenu'
import { useSignOutAndForget } from './useSignOutAndForget'

/**
 * The account menu — who is signed in, and the two things to do about it.
 *
 * The masthead trigger shows the player's display name beside their Discord
 * avatar in a circle (the initial when there is no avatar, or it will not
 * load); it opens a `HeaderMenu` holding **Settings** (`/settings`) and
 * **Sign out**, then **About** and **Changelog** — which left the bar for the
 * drawer's foot (issue 1255) and need a door on a desktop, which has no drawer.
 * The `compact` form is the avatar alone, for the mobile header row, which has
 * no room for a name.
 *
 * ## When it renders
 *
 * Only for a signed-in session — Connected **or Disconnected**. Offline, the
 * player is still signed in, so the identity stays on screen and Sign out still
 * works (it clears the local session; it needs no server). The name comes from
 * `api.account.me`, so a cold start offline has none to show: the trigger then
 * reads "Account" over a generic glyph rather than guessing.
 *
 * Signed out it renders nothing; the sign-in button is the header's job
 * (`HeaderAccount.tsx`).
 */

type AccountMenuProps = {
  /** Avatar only — the mobile header row. */
  compact?: boolean
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

function SignedInAccountMenu({ compact = false }: AccountMenuProps) {
  const me = useQuery(api.account.me, {})
  const signOut = useSignOutAndForget()
  const navigate = useNavigate()

  const name = me?.displayName ?? null

  return (
    <HeaderMenu
      label={name === null ? 'Account menu' : `Account menu for ${name}`}
      chevron={!compact}
      trigger={
        <>
          <Avatar src={me?.avatarUrl ?? null} name={name ?? ''} size={compact ? 32 : 28} />
          {!compact && <span style={NAME}>{name ?? 'Account'}</span>}
        </>
      }
      sections={[
        [
          {
            id: 'settings',
            label: 'Settings',
            onSelect: () => void navigate({ to: '/settings' }),
          },
          { id: 'sign-out', label: 'Sign out', onSelect: signOut },
        ],
        [
          { id: 'about', label: 'About', onSelect: () => void navigate({ to: '/about' }) },
          {
            id: 'changelog',
            label: 'Changelog',
            onSelect: () => void navigate({ to: '/changelog' }),
          },
        ],
      ]}
    />
  )
}

export function AccountMenu({ compact }: AccountMenuProps) {
  const { mode } = useConnection()
  if (mode !== 'connected' && mode !== 'disconnected') return null
  return <SignedInAccountMenu compact={compact} />
}
