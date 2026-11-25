import { afterAll, afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { act, cleanup, render, screen } from '@testing-library/react'

/**
 * The Activity's first moment (`../ActivityBoot.tsx`): a splash while Discord
 * signs the player in, the app once it has (with who is in the Activity and
 * the way out through the SDK), or the reason it stopped. The SDK is a
 * stand-in; the Worker's answers are stubbed `fetch` replies.
 */

const calls: string[] = []
const listeners = new Map<string, (event: never) => void>()

class FakeSdk {
  constructor(readonly clientId: string) {
    calls.push(`new ${clientId}`)
  }
  ready = async () => {
    calls.push('ready')
  }
  commands = {
    authorize: async () => ({ code: 'sdk-code' }),
    authenticate: async () => ({
      user: { id: '80351110224678912', username: 'rae', global_name: 'Rae', avatar: null },
    }),
    getActivityInstanceConnectedParticipants: async () => ({
      participants: [
        { id: '80351110224678912', username: 'rae', global_name: 'Rae', avatar: null },
        { id: '80351110224678913', username: 'kes', avatar: null },
      ],
    }),
    openExternalLink: async ({ url }: { url: string }) => {
      calls.push(`open ${url}`)
      return { opened: true }
    },
  }
  subscribe = async (event: string, listener: (event: never) => void) => {
    listeners.set(event, listener)
  }
  unsubscribe = async (event: string) => {
    listeners.delete(event)
  }
}

const realSdk = { ...(await import('@discord/embedded-app-sdk')) }
mock.module('@discord/embedded-app-sdk', () => ({
  ...realSdk,
  DiscordSDK: FakeSdk,
  patchUrlMappings: (mappings: { prefix: string; target: string }[]) => {
    calls.push(`patch ${mappings.map((m) => `${m.prefix}=${m.target}`).join(',')}`)
  },
}))

const { ActivityBoot } = await import('../ActivityBoot')
const { activityStore } = await import('../activityStore')
const { mapActivityUrls } = await import('../frame')

afterEach(() => {
  cleanup()
  activityStore.stop()
  calls.length = 0
  listeners.clear()
})

afterAll(() => {
  mock.module('@discord/embedded-app-sdk', () => realSdk)
})

/** The Worker's answers: its client id, then the trade for an access token. */
function worker(clientId: string | null, trades = true) {
  return spyOn(globalThis, 'fetch').mockImplementation((async (
    _url: unknown,
    init?: RequestInit
  ) => {
    if (init?.method === 'POST') {
      return trades ? Response.json({ accessToken: 'token' }) : new Response(null, { status: 403 })
    }
    return clientId === null ? new Response(null, { status: 503 }) : Response.json({ clientId })
  }) as typeof fetch)
}

describe('ActivityBoot', () => {
  test('signs in with Discord, then shows the app; follows who is here and how Discord shows it', async () => {
    const fetchSpy = worker('client')
    await act(async () => {
      render(<ActivityBoot app={<p>The app</p>} />)
    })
    await screen.findByText('The app')
    expect(calls).toContain('new client')
    const activity = activityStore.get()
    expect(activity?.me.name).toBe('Rae')
    expect(activity?.people.map((p) => p.name)).toEqual(['Rae', 'kes'])
    await act(async () => {
      listeners.get('ACTIVITY_LAYOUT_MODE_UPDATE')?.({ layout_mode: 1 } as never)
    })
    expect(activityStore.get()?.layout).toBe('pip')
    activityStore.get()?.openOutside('https://salvageunion.io/chassis/mule/')
    await Promise.resolve()
    expect(calls).toContain('open https://salvageunion.io/chassis/mule/')
    fetchSpy.mockRestore()
  })

  test('says why when sign-in is not set up', async () => {
    const fetchSpy = worker(null)
    await act(async () => {
      render(<ActivityBoot app={<p>The app</p>} />)
    })
    await screen.findByText('Sign-in is not set up on this site.')
    expect(screen.queryByText('The app')).toBeNull()
    fetchSpy.mockRestore()
  })

  test("says why when Discord's sign-in is refused, and lets go of the SDK when it closes", async () => {
    const fetchSpy = worker('client', false)
    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {})
    let view: ReturnType<typeof render> | undefined
    await act(async () => {
      view = render(<ActivityBoot app={<p>The app</p>} />)
    })
    await screen.findByText('Discord would not sign you in. Try again.')
    expect(activityStore.get()).toBeNull()
    await act(async () => {
      view?.unmount()
    })
    consoleSpy.mockRestore()
    fetchSpy.mockRestore()
  })

  test('a signed-in Activity, closed, stops listening to Discord', async () => {
    const fetchSpy = worker('client')
    let view: ReturnType<typeof render> | undefined
    await act(async () => {
      view = render(<ActivityBoot app={<p>The app</p>} />)
    })
    await screen.findByText('The app')
    await act(async () => {
      await Promise.resolve()
    })
    expect(listeners.size).toBe(2)
    await act(async () => {
      view?.unmount()
    })
    expect(listeners.size).toBe(0)
    fetchSpy.mockRestore()
  })

  test("the test seam's stand-in: the app at once, with no Discord, and links outside noted", async () => {
    await act(async () => {
      render(<ActivityBoot app={<p>The app</p>} standIn />)
    })
    await screen.findByText('The app')
    expect(calls).toEqual([])
    expect(activityStore.get()?.people.map((p) => p.name)).toEqual(['Tester', 'Mediator', 'Crew'])
    activityStore.get()?.openOutside('https://salvageunion.io/')
    expect(document.documentElement.dataset.activityOutside).toBe('https://salvageunion.io/')
    delete document.documentElement.dataset.activityOutside
  })

  test("in Discord's frame the art host goes through the `/art` URL Mapping; on the site, nothing", async () => {
    await mapActivityUrls('salvageunion.io')
    expect(calls).toEqual([])
    await mapActivityUrls('1442878052823470172.discordsays.com')
    expect(calls).toEqual(['patch /art=assets.salvageunion.io'])
  })
})
