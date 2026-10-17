import { useAuthActions } from '@convex-dev/auth/react'
import { useNavigate } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'
import { returnTo } from '../../lib/account/returnTo'
import { useConnection } from '../../lib/connection/connectionContext'
import { captureException } from '../../lib/observability'
import { Text } from '../index'
import { useSignOut } from './useSignOut'

/**
 * The two doors the SRD's Union bar opens into The Cantina. The SRD has no
 * backend, so its Sign in and its account menu's Sign out cannot touch the
 * session themselves: they link here, and these act once the session is known.
 *
 * - `/sign-in` starts Discord's round trip, which lands in the Hangar; a player
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
  const { mode } = useConnection()
  const { signIn } = useAuthActions()
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    if (mode === 'connecting' || started.current) return
    started.current = true
    if (mode === 'solo') {
      // Discord's page replaces this one; a failure to start is reported and
      // leaves the player on the Hangar's own sign-in.
      signIn('discord').catch((err: unknown) => {
        captureException(err)
        void navigate({ to: '/', replace: true })
      })
    } else {
      void navigate({ to: '/', replace: true })
    }
  }, [mode, signIn, navigate])

  return <Handoff>Signing in with Discord…</Handoff>
}

export function SignOutHandoff({ to }: { to?: string }) {
  const { mode } = useConnection()
  const signOut = useSignOut()
  const started = useRef(false)

  useEffect(() => {
    // Wait for the session to load: signing out before it has would leave the
    // server's session behind.
    if (mode === 'connecting' || started.current) return
    started.current = true
    void signOut().then(() => {
      window.location.replace(returnTo(to, window.location.href))
    })
  }, [mode, signOut, to])

  return <Handoff>Signing out…</Handoff>
}
