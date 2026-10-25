import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, render } from '@testing-library/react'

/**
 * `useGamePresence` — one socket per Game and role, shared by its callers,
 * holding who the Game room says is here (play.md §7). The socket is a
 * stand-in recording what the hook opens and closes.
 */

import { installConvexMocks } from '../../components/__tests__/convexMock'
import type { SyncStatus } from '../../replica/sync'

const convexMocks = await installConvexMocks({
  also: { '../../lib/auth/session': () => ({ useSessionToken: () => 'tok' }) },
})

const { useGamePresence } = await import('../useGamePresence')
const { SyncContext } = await import('../../replica/syncContext')

class FakeSocket {
  static opened: FakeSocket[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  closedWith: number | null = null
  constructor(
    readonly url: string,
    readonly protocols: string[]
  ) {
    FakeSocket.opened.push(this)
  }
  close(code: number) {
    this.closedWith = code
  }
  say(here: string[]) {
    act(() => this.onmessage?.({ data: JSON.stringify({ type: 'presence', here }) }))
  }
}

const realSocket = globalThis.WebSocket
globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket

beforeEach(() => {
  window.location.href = 'http://localhost/play/'
})

afterEach(() => {
  FakeSocket.opened.length = 0
})

afterAll(() => {
  globalThis.WebSocket = realSocket
  convexMocks.restore()
})

const seen: Record<string, ReadonlySet<string> | null> = {}

function Probe({
  name,
  gameId,
  role,
}: {
  name: string
  gameId: string | null
  role: 'seat' | 'watch'
}) {
  seen[name] = useGamePresence(gameId, role)
  return null
}

function connection(status: SyncStatus) {
  return { status, canWrite: true, outdated: false }
}

function mount(
  status: SyncStatus,
  probes: { name: string; gameId: string | null; role: 'seat' | 'watch' }[]
) {
  return render(
    <SyncContext.Provider value={connection(status)}>
      {probes.map((p) => (
        <Probe key={p.name} {...p} />
      ))}
    </SyncContext.Provider>
  )
}

describe('useGamePresence', () => {
  test('callers of one Game and role share a socket, and hear who is here', () => {
    const view = mount('live', [
      { name: 'a', gameId: 'g1', role: 'seat' },
      { name: 'b', gameId: 'g1', role: 'seat' },
    ])
    expect(FakeSocket.opened).toHaveLength(1)
    const [socket] = FakeSocket.opened
    expect(socket?.url).toMatch(/^ws:.*\/__rooms\/games\/g1\/socket\?seat=1$/)
    expect(socket?.protocols).toEqual(['su-room', 'tok'])
    expect(seen.a).toBeNull()
    socket?.say(['u1', 'u2'])
    expect([...(seen.a ?? [])]).toEqual(['u1', 'u2'])
    expect([...(seen.b ?? [])]).toEqual(['u1', 'u2'])
    view.unmount()
    expect(socket?.closedWith).toBe(1000)
  })

  test('a watcher opens its own socket that does not count it', () => {
    const view = mount('live', [{ name: 'w', gameId: 'g2', role: 'watch' }])
    expect(FakeSocket.opened[0]?.url).toMatch(/\?seat=0$/)
    view.unmount()
  })

  test('a drop forgets who was here and reopens after a wait', () => {
    const view = mount('live', [{ name: 'd', gameId: 'g3', role: 'seat' }])
    const first = FakeSocket.opened[0]
    act(() => first?.onopen?.())
    first?.say(['u1'])
    const originalTimeout = globalThis.setTimeout
    let reopen: (() => void) | null = null
    globalThis.setTimeout = ((fn: () => void) => {
      reopen = fn
      return 0
    }) as unknown as typeof setTimeout
    act(() => first?.onclose?.())
    globalThis.setTimeout = originalTimeout
    expect(seen.d).toBeNull()
    act(() => (reopen as (() => void) | null)?.())
    expect(FakeSocket.opened).toHaveLength(2)
    view.unmount()
  })

  test('opens nothing offline or outside a Game', () => {
    const view = mount('offline', [{ name: 'o', gameId: 'g4', role: 'seat' }])
    const solo = mount('live', [{ name: 's', gameId: null, role: 'seat' }])
    expect(FakeSocket.opened).toHaveLength(0)
    expect(seen.o).toBeNull()
    expect(seen.s).toBeNull()
    view.unmount()
    solo.unmount()
  })
})
