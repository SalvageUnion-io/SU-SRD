/**
 * The Discord Activity's first screen: who is signed in and who else is at
 * the table. One Moment's Main display (the cockpit chosen 2026-11-24) grows
 * on this frame in the steps after it; this one proves the frame, the sign-in
 * and the proxy.
 *
 * Outside Discord (no `frame_id`), the page says where to open it. Discord
 * shows the frame focused, in picture-in-picture or in the grid, and the app
 * is told which (`LayoutMode`); nothing here asks for a mode, since none can.
 */

import type { DiscordSDK } from '@discord/embedded-app-sdk'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { TitledBox } from '../components/containers/TitledBox'
import { font, space } from '../design/tokens'
import { activityCopy } from '../messages/activity'
import type { ActivityLaunch, ActivityPerson, LayoutMode, SdkUser } from './activitySession'
import { activityClientId, layoutModeOf, personOf, signInActivity } from './activitySession'

/** Where the Activity is: outside Discord, signing in, in, or stopped with a reason. */
type Phase =
  | { kind: 'outside' }
  | { kind: 'signing-in' }
  | { kind: 'in'; me: ActivityPerson }
  | { kind: 'stopped'; reason: string }

/** Discord's mobile safe areas (`--discord-safe-area-inset-*`); 0 elsewhere. */
const SAFE_TOP = 'var(--discord-safe-area-inset-top, 0px)'
const SAFE_BOTTOM = 'var(--discord-safe-area-inset-bottom, 0px)'

const SCREEN = {
  minHeight: '100dvh',
  boxSizing: 'border-box',
  // Discord's mobile safe areas, as its CSS variables give them.
  paddingTop: `max(${space[12]}, ${SAFE_TOP})`,
  paddingInline: space[12],
  paddingBottom: `max(${space[12]}, ${SAFE_BOTTOM})`,
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  background: 'var(--color-paper)',
  color: 'var(--color-ink)',
  fontFamily: font.body,
} satisfies CSSProperties

const PEOPLE = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
} satisfies CSSProperties

const PERSON = { display: 'flex', alignItems: 'center', gap: space[8] } satisfies CSSProperties

const AVATAR = { width: 28, height: 28, borderRadius: '50%' } satisfies CSSProperties

const NOTE = { margin: 0 } satisfies CSSProperties

/** How the layout reads to a player. */
function layoutWords(layout: LayoutMode): string {
  if (layout === 'pip') return activityCopy('layoutPip')
  if (layout === 'grid') return activityCopy('layoutGrid')
  return activityCopy('layoutFocused')
}

export function ActivityApp({ launch }: { launch: ActivityLaunch | null }) {
  const [phase, setPhase] = useState<Phase>(
    launch === null ? { kind: 'outside' } : { kind: 'signing-in' }
  )
  const [people, setPeople] = useState<readonly ActivityPerson[]>([])
  const [layout, setLayout] = useState<LayoutMode>('focused')

  useEffect(() => {
    if (launch === null) return
    let sdk: DiscordSDK | null = null
    const onPeople = ({ participants }: { participants: SdkUser[] }) =>
      setPeople(participants.map(personOf))
    const onLayout = ({ layout_mode }: { layout_mode: number }) =>
      setLayout(layoutModeOf(layout_mode))
    void (async () => {
      try {
        const clientId = await activityClientId()
        if (clientId === null) {
          setPhase({ kind: 'stopped', reason: activityCopy('unset') })
          return
        }
        const { DiscordSDK } = await import('@discord/embedded-app-sdk')
        sdk = new DiscordSDK(clientId)
        const me = await signInActivity(sdk, clientId)
        setPhase({ kind: 'in', me })
        const { participants } = await sdk.commands.getActivityInstanceConnectedParticipants()
        onPeople({ participants })
        await sdk.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', onPeople)
        await sdk.subscribe('ACTIVITY_LAYOUT_MODE_UPDATE', onLayout)
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
  }, [launch])

  return (
    <main style={SCREEN}>
      <TitledBox title={activityCopy('site')} titleAs="h1">
        {phase.kind === 'outside' && <p style={NOTE}>{activityCopy('outside')}</p>}
        {phase.kind === 'signing-in' && (
          <p role="status" style={NOTE}>
            {activityCopy('signingIn')}
          </p>
        )}
        {phase.kind === 'stopped' && (
          <p role="status" style={NOTE}>
            {phase.reason}
          </p>
        )}
        {phase.kind === 'in' && (
          <p style={NOTE}>
            {activityCopy('signedInAs', { name: phase.me.name })} {layoutWords(layout)}
          </p>
        )}
      </TitledBox>
      {phase.kind === 'in' && (
        <TitledBox title={activityCopy('atTheTable')}>
          <ul style={PEOPLE}>
            {people.map((person) => (
              <li key={person.id} style={PERSON}>
                <img src={person.avatarUrl} alt="" style={AVATAR} />
                {person.name}
              </li>
            ))}
          </ul>
        </TitledBox>
      )}
    </main>
  )
}
