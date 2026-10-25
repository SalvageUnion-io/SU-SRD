import { useAuthActions } from '@convex-dev/auth/react'
import { useNavigate } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'
import { Text } from '../../components/index'
import { returnTo } from '../../lib/account/returnTo'
import { captureException } from '../../lib/observability'
import { buildAccountCopy } from '../../messages/build-account'
import { useSync } from '../../replica/syncContext'
import { useSignOut } from './useSignOut'

/**
 * The two doors the SRD's Union bar opens into the app. The SRD has no
 * backend, so its Sign in and its account menu's Sign out cannot touch the
 * session themselves: they link here, and these act once the session is known.
 *
 * - `/sign-in` starts Discord's round trip, which lands in the Training Bay; a player
 *   already signed in goes straight there.
 * - `/sign-out?to=…` ends the session, then goes back to the SRD page the menu
 *   was opened on (`returnTo` keeps that to this site or the SRD).
 */

/** The page body's gutters, without its measure or its head and foot. */
const HANDOFF = { maxWidth: 'none', paddingBlock: 0 } satisfies CSSProperties

function Handoff({ children }: { children: string }) {
  return (
    <main className="su-page-body" style={HANDOFF}>
      <Text variant="hint">{children}</Text>
    </main>
  )
}

export function SignInHandoff() {
  const { status } = useSync()
  const { signIn } = useAuthActions()
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    if (status === 'syncing' || started.current) return
    started.current = true
    if (status === 'signedOut') {
      // Discord's page replaces this one; a failure to start is reported and
      // leaves the player on the Training Bay's own sign-in.
      signIn('discord').catch((err: unknown) => {
        captureException(err)
        void navigate({ to: '/', replace: true })
      })
    } else {
      void navigate({ to: '/', replace: true })
    }
  }, [status, signIn, navigate])

  return <Handoff>{buildAccountCopy('signingInWithDiscord')}</Handoff>
}

export function SignOutHandoff({ to }: { to?: string }) {
  const { status } = useSync()
  const signOut = useSignOut()
  const started = useRef(false)

  useEffect(() => {
    // Wait for the session to load: signing out before it has would leave the
    // server's session behind.
    if (status === 'syncing' || started.current) return
    started.current = true
    void signOut().then(() => {
      window.location.replace(returnTo(to, window.location.href))
    })
  }, [status, signOut, to])

  return <Handoff>{buildAccountCopy('signingOut')}</Handoff>
}
