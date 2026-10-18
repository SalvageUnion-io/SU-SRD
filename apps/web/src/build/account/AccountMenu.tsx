import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { DOC_PAGES } from '../../lib/docPages'
import { AccountMenu as SharedAccountMenu } from '../../components/index'
import { useSignOut } from './useSignOut'

/**
 * The Cantina's account menu: the UI library's `AccountMenu`, the one the SRD's
 * bar shows too, over this session. The name and avatar come from
 * `api.account.me`; Settings routes in place and Sign out ends the session
 * here.
 *
 * ## When it renders
 *
 * Only for a signed-in session — Connected **or Disconnected**. Offline, the
 * player is still signed in, so the identity stays on screen and Sign out still
 * works (it clears the local session; it needs no server). `api.account.me`
 * has no answer on a cold start offline, so the trigger then reads "Account".
 *
 * Signed out it renders nothing; the sign-in button is the header's job
 * (`HeaderAccount.tsx`).
 */

type AccountMenuProps = {
  /** Avatar only — the mobile header row. */
  compact?: boolean
}

function SignedInAccountMenu({ compact = false }: AccountMenuProps) {
  const me = useQuery(api.account.me, {})
  const signOut = useSignOut()
  const navigate = useNavigate()

  return (
    <SharedAccountMenu
      name={me?.displayName ?? null}
      avatarUrl={me?.avatarUrl ?? null}
      compact={compact}
      onSettings={() => void navigate({ to: '/settings' })}
      onSignOut={signOut}
      aboutHref={DOC_PAGES.about.href}
      changelogHref={DOC_PAGES.changelog.href}
    />
  )
}

export function AccountMenu({ compact }: AccountMenuProps) {
  const { mode } = useConnection()
  if (mode !== 'connected' && mode !== 'disconnected') return null
  return <SignedInAccountMenu compact={compact} />
}
