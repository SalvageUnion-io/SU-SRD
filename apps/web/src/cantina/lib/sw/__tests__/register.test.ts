/**
 * Service worker registration + activation tests.
 *
 * `registerServiceWorker()` takes `virtual:pwa-register`'s `registerSW` as an
 * argument, because the virtual module resolves only in Vite's build; a
 * recording stand-in replaces it here. The other parts that carry risk take
 * only the slice of the SW API they use, so plain objects stand in:
 * `activateWaitingWorker` / `reloadOntoNewBuild` (how a tab moves onto a new
 * build), `keepCheckingForUpdates` (when a long-lived tab asks for a new
 * worker) and `serverBootsAnotherBuild` (whether the server has moved on).
 */
import { describe, expect, it } from 'bun:test'
import type { RegisterSWOptions } from 'vite-plugin-pwa/types'
import {
  activateWaitingWorker,
  keepCheckingForUpdates,
  registerServiceWorker,
  reloadOntoNewBuild,
  serverBootsAnotherBuild,
  UPDATE_CHECK_INTERVAL_MS,
} from '../register'

type Listener = (event?: unknown) => void

/** A stand-in ServiceWorker whose posted messages are recorded. */
function fakeWorker() {
  const posted: unknown[] = []
  return { posted, postMessage: (message: unknown) => void posted.push(message) }
}

function fakeRegistration(initial: { waiting?: unknown } = {}) {
  return { waiting: initial.waiting ?? null }
}

function fakeContainer(controller: unknown) {
  const listeners = new Map<string, Listener[]>()
  return {
    controller,
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn])
    },
    emit: (type: string) => {
      for (const fn of listeners.get(type) ?? []) fn()
    },
  }
}

// biome-ignore lint/suspicious/noExplicitAny: structural stand-ins for the SW API
const asAny = (value: unknown) => value as any

describe('registerServiceWorker', () => {
  /** A stand-in for `virtual:pwa-register`'s `registerSW`, recording its options. */
  function fakeRegisterSW() {
    const calls: RegisterSWOptions[] = []
    return { calls, registerSW: (options: RegisterSWOptions) => void calls.push(options) }
  }

  it('registers through the one registerSW it is handed, once', () => {
    const { calls, registerSW } = fakeRegisterSW()
    registerServiceWorker(registerSW)
    expect(calls).toHaveLength(1)
  })

  it('starts the update checks once the worker is registered', () => {
    const { calls, registerSW } = fakeRegisterSW()
    registerServiceWorker(registerSW)
    let updates = 0
    const registration = asAny({
      update: () => {
        updates += 1
        return Promise.resolve()
      },
    })
    calls[0]?.onRegisteredSW?.('/sw.js', registration)
    expect(updates).toBe(1)
  })

  it('reports a failed registration without throwing', () => {
    const { calls, registerSW } = fakeRegisterSW()
    registerServiceWorker(registerSW)
    expect(() => calls[0]?.onRegisterError?.(new Error('Rejected'))).not.toThrow()
  })

  it('hands both new-build signals to onNewBuild, so another tab no longer reloads this one', () => {
    const { calls, registerSW } = fakeRegisterSW()
    let signals = 0
    registerServiceWorker(registerSW, {
      onNewBuild: () => {
        signals += 1
      },
    })
    calls[0]?.onNeedRefresh?.()
    calls[0]?.onNeedReload?.()
    expect(signals).toBe(2)
  })

  it("leaves the plugin's own reload in place without onNewBuild", () => {
    const { calls, registerSW } = fakeRegisterSW()
    registerServiceWorker(registerSW)
    expect(calls[0]?.onNeedReload).toBeUndefined()
  })

  it('records the entry chunk the server shell is compared against', async () => {
    const { registerSW } = fakeRegisterSW()
    registerServiceWorker(registerSW, { entryChunk: '/assets/index-OLD.js' })
    const shell = (html: string) => () => Promise.resolve(new Response(html))
    expect(
      await serverBootsAnotherBuild(undefined, shell('<script src="/assets/index-NEW.js">'))
    ).toBe(true)
    expect(
      await serverBootsAnotherBuild(undefined, shell('<script src="/assets/index-OLD.js">'))
    ).toBe(false)
  })
})

describe('activateWaitingWorker', () => {
  it('posts SKIP_WAITING and defers the reload to controllerchange', () => {
    const waiting = fakeWorker()
    const container = fakeContainer({})
    let reloads = 0

    activateWaitingWorker(asAny(fakeRegistration({ waiting })), asAny(container), () => {
      reloads += 1
    })

    // The message went out, but reloading now would race skipWaiting() and can
    // land back on the old worker — so nothing has reloaded yet.
    expect(waiting.posted).toEqual([{ type: 'SKIP_WAITING' }])
    expect(reloads).toBe(0)

    container.emit('controllerchange')
    expect(reloads).toBe(1)
  })

  it('reloads directly when nothing is waiting', () => {
    let reloads = 0
    activateWaitingWorker(asAny(fakeRegistration()), asAny(fakeContainer({})), () => {
      reloads += 1
    })
    expect(reloads).toBe(1)
  })
})

describe('reloadOntoNewBuild', () => {
  it('activates the waiting worker of this page’s registration', async () => {
    const waiting = fakeWorker()
    const container = {
      ...fakeContainer({}),
      getRegistration: async () => fakeRegistration({ waiting }),
    }
    await reloadOntoNewBuild(asAny(container), () => {})
    expect(waiting.posted).toEqual([{ type: 'SKIP_WAITING' }])
  })

  it('is a plain reload with no service worker at all', async () => {
    let reloads = 0
    await reloadOntoNewBuild(undefined, () => {
      reloads += 1
    })
    expect(reloads).toBe(1)
  })

  it('is a plain reload when the registration cannot be read', async () => {
    let reloads = 0
    const container = {
      ...fakeContainer({}),
      getRegistration: () => Promise.reject(new Error('SecurityError')),
    }
    await reloadOntoNewBuild(asAny(container), () => {
      reloads += 1
    })
    expect(reloads).toBe(1)
  })
})

/** A document stand-in whose visibility the test controls. */
function fakeDocument(initial: DocumentVisibilityState = 'visible') {
  const listeners = new Map<string, Listener[]>()
  return {
    visibilityState: initial,
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn])
    },
    removeEventListener: (type: string, fn: Listener) => {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((f) => f !== fn)
      )
    },
    show(state: DocumentVisibilityState) {
      this.visibilityState = state
      for (const fn of listeners.get('visibilitychange') ?? []) fn()
    },
  }
}

/** A registration whose `update()` calls are counted. */
function countingRegistration(outcome: () => Promise<void> = () => Promise.resolve()) {
  let updates = 0
  return {
    get updates() {
      return updates
    },
    update: () => {
      updates += 1
      return outcome()
    },
  }
}

describe('keepCheckingForUpdates', () => {
  /** Drives the clock and the interval by hand — no real timers, no sleeps. */
  function harness(doc = fakeDocument()) {
    const registration = countingRegistration()
    let clock = 1_000_000
    const ticks: Array<{ tick: () => void; ms: number }> = []
    let stopped = false
    const teardown = keepCheckingForUpdates(asAny(registration), asAny(doc), {
      now: () => clock,
      every: (tick, ms) => {
        ticks.push({ tick, ms })
        return () => {
          stopped = true
        }
      },
    })
    return {
      registration,
      doc,
      teardown,
      ticks,
      get stopped() {
        return stopped
      },
      advance(ms: number) {
        clock += ms
      },
    }
  }

  it('checks once as soon as the worker is registered', () => {
    const { registration } = harness()
    expect(registration.updates).toBe(1)
  })

  it('checks again when the tab comes back into view', () => {
    // The returning-to-an-open-tab case: a SPA makes no navigation, so the
    // browser's own per-navigation check never runs.
    const h = harness()
    h.advance(10 * 60 * 1000)
    h.doc.show('hidden')
    expect(h.registration.updates).toBe(1)
    h.doc.show('visible')
    expect(h.registration.updates).toBe(2)
  })

  it('checks hourly, but only while the tab is visible', () => {
    const h = harness()
    expect(h.ticks).toHaveLength(1)
    expect(h.ticks[0]?.ms).toBe(UPDATE_CHECK_INTERVAL_MS)

    h.advance(UPDATE_CHECK_INTERVAL_MS)
    h.ticks[0]?.tick()
    expect(h.registration.updates).toBe(2)

    h.doc.visibilityState = 'hidden'
    h.advance(UPDATE_CHECK_INTERVAL_MS)
    h.ticks[0]?.tick()
    expect(h.registration.updates).toBe(2)
  })

  it('does not check again inside a minute of the last check', () => {
    // Each check is a request the Worker answers; alt-tabbing must not be a
    // stream of them.
    const h = harness()
    h.advance(5_000)
    h.doc.show('hidden')
    h.doc.show('visible')
    expect(h.registration.updates).toBe(1)
  })

  it('swallows an offline update failure instead of rejecting unhandled', async () => {
    let rejected = 0
    const registration = countingRegistration(() => {
      rejected += 1
      return Promise.reject(new TypeError('Failed to update a ServiceWorker'))
    })
    keepCheckingForUpdates(asAny(registration), asAny(fakeDocument()), {
      every: () => () => {},
    })
    // Let the rejection settle; an unhandled one would fail the run.
    await Promise.resolve()
    expect(rejected).toBe(1)
  })

  it('stops checking on teardown', () => {
    const h = harness()
    h.teardown()
    expect(h.stopped).toBe(true)
    h.advance(10 * 60 * 1000)
    h.doc.show('visible')
    expect(h.registration.updates).toBe(1)
  })
})

describe('serverBootsAnotherBuild', () => {
  const ENTRY = '/assets/index-NEWHASH.js'
  const shell = (src: string) => async () =>
    new Response(`<!doctype html><script type="module" crossorigin src="${src}"></script>`)

  it('is false while the server shell boots this page’s entry chunk', async () => {
    expect(await serverBootsAnotherBuild(ENTRY, shell(ENTRY))).toBe(false)
  })

  it('is true once the server shell boots a different build', async () => {
    expect(await serverBootsAnotherBuild(ENTRY, shell('/assets/index-NEWERHASH.js'))).toBe(true)
  })

  it('answers false when it cannot tell — a reload offline would loop', async () => {
    const offline = async (): Promise<Response> => {
      throw new TypeError('Failed to fetch')
    }
    expect(await serverBootsAnotherBuild(ENTRY, offline)).toBe(false)
    expect(
      await serverBootsAnotherBuild(ENTRY, async () => new Response('', { status: 503 }))
    ).toBe(false)
  })
})
