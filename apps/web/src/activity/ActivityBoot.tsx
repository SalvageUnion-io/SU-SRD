/**
 * The Discord Activity's first moment: the SDK's sign-in, then the app itself
 * as the Activity (`activityStore`). While Discord signs the player in, a
 * splash on the Activity's own ground says so; a sign-in that stops says why.
 * Once in, the app renders under the Activity's shell (`ActivityShell`, from
 * the root route), on a router that never changes the frame's address, so the
 * SDK's connection lives as long as the Activity does.
 *
 * Discord shows the frame focused, in picture-in-picture or in the grid, and
 * tells the app which (`LayoutMode`); nothing here asks for a mode, since none
 * can be asked for.
 */

import type { DiscordSDK } from '@discord/embedded-app-sdk'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { testAuthBridgeEnabled } from '../build/account/testAuthSeam.model'
import { capsLabel } from '../components/atoms/capsLabel'
import { font, space } from '../design/tokens'
import { activityCopy } from '../messages/activity'
import type { SdkUser } from './activitySession'
import { activityClientId, layoutModeOf, personOf, signInActivity } from './activitySession'
import { activityStore, useActivity } from './activityStore'

/**
 * The sign-in's moment, before any of the app's stylesheets load: the
 * Activity's name on the chrome's ground (K13), filling the frame.
 */
const SPLASH = {
  alignItems: 'center',
  background: 'var(--color-ink-deep)',
  boxSizing: 'border-box',
  color: 'var(--color-paper)',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: font.body,
  gap: space[12],
  justifyContent: 'center',
  minHeight: '100dvh',
  padding: space[24],
  textAlign: 'center',
} satisfies CSSProperties

const MARK = { margin: 0 } satisfies CSSProperties

const MARK_CAPS = capsLabel({ size: 'display', tracking: 'eyebrow' })

const NOTE = { margin: 0 } satisfies CSSProperties

/**
 * A test seam, as `TestAuthBridge` is one: in a build made with
 * `VITE_TEST_AUTH` (the dev server, the nightly e2e build; never production,
 * whose bundle folds the flag away), `?activity_stand_in` runs the Activity
 * with no Discord around it, signed in by the test sign-in, so a screenshot
 * or a browser test can see its screens.
 */
const STAND_IN_PARAM = 'activity_stand_in'

function standIn(): boolean {
  return testAuthBridgeEnabled && new URLSearchParams(window.location.search).has(STAND_IN_PARAM)
}

/** The stand-in's people, Discord's default faces. */
const STAND_IN_PEOPLE = ['Tester', 'Mediator', 'Crew'].map((name, index) => ({
  id: String(index),
  name,
  avatarUrl: `https://cdn.discordapp.com/embed/avatars/${index}.png`,
}))

/** Where the sign-in is: under way, or stopped with a reason. */
type Phase = { kind: 'signing-in' } | { kind: 'stopped'; reason: string }

export function ActivityBoot({ app }: { app: ReactNode }) {
  const activity = useActivity()
  const [phase, setPhase] = useState<Phase>({ kind: 'signing-in' })

  useEffect(() => {
    if (standIn()) {
      const [me, ...rest] = STAND_IN_PEOPLE
      if (me !== undefined) {
        activityStore.start({
          me,
          people: [me, ...rest],
          layout: 'focused',
          // No Discord to open a browser for: the link is left on `<html>`
          // for a test to read, and the frame stays where it is.
          openOutside: (url) => {
            document.documentElement.dataset.activityOutside = url
          },
        })
      }
      return
    }
    let sdk: DiscordSDK | null = null
    const onPeople = ({ participants }: { participants: SdkUser[] }) =>
      activityStore.update({ people: participants.map(personOf) })
    const onLayout = ({ layout_mode }: { layout_mode: number }) =>
      activityStore.update({ layout: layoutModeOf(layout_mode) })
    void (async () => {
      try {
        const clientId = await activityClientId()
        if (clientId === null) {
          setPhase({ kind: 'stopped', reason: activityCopy('unset') })
          return
        }
        const { DiscordSDK } = await import('@discord/embedded-app-sdk')
        const signedIn = new DiscordSDK(clientId)
        sdk = signedIn
        const me = await signInActivity(signedIn, clientId)
        activityStore.start({
          me,
          people: [me],
          layout: 'focused',
          openOutside: (url) => {
            signedIn.commands.openExternalLink({ url }).catch((err: unknown) => {
              // The player said no to leaving, or Discord refused: either
              // way the frame stays where it is, and the refusal is reported.
              console.error('Activity link refused', err)
            })
          },
        })
        const { participants } = await signedIn.commands.getActivityInstanceConnectedParticipants()
        onPeople({ participants })
        await signedIn.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', onPeople)
        await signedIn.subscribe('ACTIVITY_LAYOUT_MODE_UPDATE', onLayout)
      } catch (err) {
        console.error('Activity sign-in failed', err)
        setPhase({
          kind: 'stopped',
          reason: err instanceof Error && err.message ? err.message : activityCopy('wentWrong'),
        })
      }
    })()
    return () => {
      void sdk?.unsubscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', onPeople)
      void sdk?.unsubscribe('ACTIVITY_LAYOUT_MODE_UPDATE', onLayout)
    }
  }, [])

  if (activity !== null) return app
  return (
    <main style={SPLASH}>
      <h1 style={MARK} className={MARK_CAPS}>
        {activityCopy('site')}
      </h1>
      <p role="status" style={NOTE}>
        {phase.kind === 'signing-in' ? activityCopy('signingIn') : phase.reason}
      </p>
    </main>
  )
}
