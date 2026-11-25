import { describe, expect, it } from 'bun:test'
import { AUTH_PATHS } from '../../lib/auth/paths'
import type { SdkForSignIn } from '../activitySession'
import {
  ActivitySignInError,
  activityClientId,
  launchOf,
  layoutModeOf,
  personOf,
  signInActivity,
} from '../activitySession'
import { inActivityFrame } from '../frame'

/**
 * The Activity's start (`../activitySession.ts`): the launch in the frame's
 * address, the SDK's sign-in against the Worker, and how Discord's people and
 * layouts read.
 */

const USER = { id: '80351110224678912', username: 'rae', global_name: 'Rae Voss', avatar: 'abc' }

function sdk(calls: string[]): SdkForSignIn {
  return {
    ready: async () => {
      calls.push('ready')
    },
    commands: {
      authorize: async (args) => {
        calls.push(`authorize ${args.client_id} ${args.scope.join(',')}`)
        return { code: 'sdk-code' }
      },
      authenticate: async ({ access_token }) => {
        calls.push(`authenticate ${access_token}`)
        return { user: USER }
      },
    },
  }
}

describe('launchOf', () => {
  it("reads Discord's launch, and nothing outside Discord", () => {
    expect(launchOf('?frame_id=f1&instance_id=i-1&platform=desktop')).toEqual({
      frameId: 'f1',
      instanceId: 'i-1',
    })
    expect(launchOf('')).toBeNull()
    expect(launchOf('?frame_id=f1')).toBeNull()
  })
})

describe('signInActivity', () => {
  it('authorizes, trades the code with the Worker, then authenticates', async () => {
    const calls: string[] = []
    const posted: unknown[] = []
    const fetcher = (async (url: string, init?: RequestInit) => {
      posted.push([url, init?.method, init?.body])
      return Response.json({ accessToken: 'discord-token' })
    }) as unknown as typeof fetch
    const me = await signInActivity(sdk(calls), 'client', fetcher)
    expect(calls).toEqual(['ready', 'authorize client identify', 'authenticate discord-token'])
    expect(posted).toEqual([[AUTH_PATHS.activity, 'POST', JSON.stringify({ code: 'sdk-code' })]])
    expect(me.name).toBe('Rae Voss')
  })

  it('stops, never authenticating, when the Worker refuses', async () => {
    const calls: string[] = []
    const fetcher = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch
    await expect(signInActivity(sdk(calls), 'client', fetcher)).rejects.toBeInstanceOf(
      ActivitySignInError
    )
    expect(calls).not.toContain('authenticate discord-token')
  })
})

describe('activityClientId', () => {
  it("reads the Worker's client id, or null where sign-in is unset", async () => {
    const ok = (async () => Response.json({ clientId: 'client' })) as unknown as typeof fetch
    expect(await activityClientId(ok)).toBe('client')
    const unset = (async () => new Response(null, { status: 503 })) as unknown as typeof fetch
    expect(await activityClientId(unset)).toBeNull()
  })
})

describe('people and layouts', () => {
  it('names a person by nickname, then display name, then username', () => {
    expect(personOf({ ...USER, nickname: 'Doc' }).name).toBe('Doc')
    expect(personOf(USER).name).toBe('Rae Voss')
    expect(personOf({ id: USER.id, username: 'rae' }).name).toBe('rae')
    expect(personOf({ id: USER.id, username: 'rae' }).avatarUrl).toStartWith(
      'https://cdn.discordapp.com/embed/avatars/'
    )
  })

  it("reads Discord's layout codes", () => {
    expect(layoutModeOf(0)).toBe('focused')
    expect(layoutModeOf(1)).toBe('pip')
    expect(layoutModeOf(2)).toBe('grid')
    expect(layoutModeOf(-1)).toBe('focused')
  })
})

describe('inActivityFrame', () => {
  it("knows Discord's proxy host from this site's own", () => {
    expect(inActivityFrame('1442878052823470172.discordsays.com')).toBe(true)
    expect(inActivityFrame('salvageunion.io')).toBe(false)
  })
})
