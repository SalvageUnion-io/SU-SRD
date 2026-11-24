/**
 * The Discord Activity's start (ADR-051's Play, moved into Discord): where
 * the frame was launched, who signs in, and who else is in it.
 *
 * Discord opens the Activity in a frame on `<client id>.discordsays.com`,
 * whose proxy reaches this site through the portal's URL Mappings. Sign-in is
 * the Embedded App SDK's: `authorize` gives a code, the Worker trades it for
 * a session and an access token (`POST /auth/activity`), and `authenticate`
 * takes the token. No sign-in screen: the player is already in Discord.
 *
 * Kept apart from the SDK's class so a test drives it with a stand-in.
 */

import type { ActivityToken } from '../lib/auth/paths'
import { AUTH_PATHS } from '../lib/auth/paths'
import { activityCopy } from '../messages/activity'

/** What Discord adds to the frame's address when it launches the Activity. */
export type ActivityLaunch = { frameId: string; instanceId: string }

/** The launch in the frame's query, or `null` for a page opened outside Discord. */
export function launchOf(search: string): ActivityLaunch | null {
  const query = new URLSearchParams(search)
  const frameId = query.get('frame_id')
  const instanceId = query.get('instance_id')
  return frameId && instanceId ? { frameId, instanceId } : null
}

/** The art host the frame reaches through the `/art` URL Mapping. */
export const ART_MAPPING = { prefix: '/art', target: 'assets.salvageunion.io' } as const

/** Someone in the Activity, as Discord names them. */
export type ActivityPerson = { id: string; name: string; avatarUrl: string }

/** How Discord is showing the frame (`ACTIVITY_LAYOUT_MODE_UPDATE`); it cannot be asked for. */
export type LayoutMode = 'focused' | 'pip' | 'grid'

/** Discord's layout code as a name; an unknown code reads as focused. */
export function layoutModeOf(code: number): LayoutMode {
  if (code === 1) return 'pip'
  if (code === 2) return 'grid'
  return 'focused'
}

/** A Discord user as the SDK hands it over, the fields read. */
export type SdkUser = {
  id: string
  username: string
  global_name?: string | null
  nickname?: string
  avatar?: string | null
}

/** A user's name and avatar, as the Activity shows them. */
export function personOf(user: SdkUser): ActivityPerson {
  const name = user.nickname || user.global_name || user.username
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`
  return { id: user.id, name, avatarUrl }
}

/** The slice of the Embedded App SDK the sign-in drives. */
export type SdkForSignIn = {
  ready(): Promise<void>
  commands: {
    authorize(args: {
      client_id: string
      response_type: 'code'
      state: string
      prompt: 'none'
      scope: ('identify' | 'guilds')[]
    }): Promise<{ code: string }>
    authenticate(args: { access_token: string }): Promise<{ user: SdkUser }>
  }
}

/** Why a sign-in stopped, in the words the Activity shows. */
export class ActivitySignInError extends Error {}

/** The Worker's client id for the SDK; `null` where sign-in is not set up. */
export async function activityClientId(fetcher: typeof fetch = fetch): Promise<string | null> {
  const res = await fetcher(AUTH_PATHS.activity, { headers: { accept: 'application/json' } })
  if (!res.ok) return null
  const body = (await res.json()) as { clientId?: unknown }
  return typeof body.clientId === 'string' ? body.clientId : null
}

/**
 * Signs the player in: the SDK's handshake, its `authorize` (only `identify`;
 * Discord asks the player once, then never again), the Worker's trade, and
 * `authenticate`. Answers who signed in; the session is the frame's cookie.
 */
export async function signInActivity(
  sdk: SdkForSignIn,
  clientId: string,
  fetcher: typeof fetch = fetch
): Promise<ActivityPerson> {
  await sdk.ready()
  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify'],
  })
  const res = await fetcher(AUTH_PATHS.activity, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
    credentials: 'include',
  })
  if (!res.ok) throw new ActivitySignInError(activityCopy('refused'))
  const { accessToken } = (await res.json()) as ActivityToken
  const { user } = await sdk.commands.authenticate({ access_token: accessToken })
  return personOf(user)
}
