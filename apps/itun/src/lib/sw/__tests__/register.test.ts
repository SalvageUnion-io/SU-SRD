/**
 * Service worker registration + update-prompt tests.
 *
 * `registerServiceWorker()` itself is only smoke-testable: `import.meta.env.DEV`
 * is true in Bun's test runner and happy-dom leaves `navigator.serviceWorker`
 * undefined, so both guards fire before the register call. The part that
 * actually carries risk — deciding *when* an update is ready and how it is
 * activated — is `watchForUpdate`, which takes only the slice of the SW API it
 * uses so a plain object can stand in. The same goes for the two pieces
 * network-first navigations added: `keepCheckingForUpdates` (when a long-lived
 * tab asks for a new worker) and `shellIsStale` / `onlyWhenStale` (whether the
 * toast is true for this tab).
 */
import { describe, expect, it } from 'bun:test'
import {
  keepCheckingForUpdates,
  onlyWhenStale,
  registerServiceWorker,
  shellIsStale,
  UPDATE_CHECK_INTERVAL_MS,
  watchForUpdate,
} from '../register'

type Listener = (event?: unknown) => void

/** A stand-in ServiceWorker whose posted messages are recorded. */
function fakeWorker(state: ServiceWorker['state'] = 'installed') {
  const listeners = new Map<string, Listener[]>()
  const posted: unknown[] = []
  return {
    posted,
    state,
    postMessage: (message: unknown) => void posted.push(message),
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn])
    },
    emit: (type: string) => {
      for (const fn of listeners.get(type) ?? []) fn()
    },
  }
}

function fakeRegistration(initial: { waiting?: unknown; installing?: unknown } = {}) {
  const listeners = new Map<string, Listener[]>()
  return {
    waiting: initial.waiting ?? null,
    installing: initial.installing ?? null,
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn])
    },
    emit: (type: string) => {
      for (const fn of listeners.get(type) ?? []) fn()
    },
  }
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
  it('returns without throwing in the test environment (DEV + no serviceWorker)', () => {
    expect(() => registerServiceWorker()).not.toThrow()
  })

  it('does not throw when called multiple times', () => {
    expect(() => {
      registerServiceWorker()
      registerServiceWorker()
      registerServiceWorker()
    }).not.toThrow()
  })

  it('accepts an onUpdateReady notifier without invoking it during the guarded exit', () => {
    let notified = false
    registerServiceWorker({
      onUpdateReady: () => {
        notified = true
      },
    })
    expect(notified).toBe(false)
  })
})

describe('watchForUpdate', () => {
  it('prompts when a worker finishes installing while a controller exists', () => {
    const installing = fakeWorker('installing')
    const registration = fakeRegistration({ installing })
    const container = fakeContainer({})
    let prompts = 0

    watchForUpdate(
      asAny(registration),
      asAny(container),
      () => {
        prompts += 1
      },
      () => {}
    )

    installing.state = 'installed'
    registration.emit('updatefound')
    installing.emit('statechange')

    expect(prompts).toBe(1)
  })

  it('does NOT prompt on a first install — no controller means nothing is stale', () => {
    const installing = fakeWorker('installing')
    const registration = fakeRegistration({ installing })
    // controller null == this page is not controlled == first ever visit.
    const container = fakeContainer(null)
    let prompts = 0

    watchForUpdate(
      asAny(registration),
      asAny(container),
      () => {
        prompts += 1
      },
      () => {}
    )

    installing.state = 'installed'
    registration.emit('updatefound')
    installing.emit('statechange')

    expect(prompts).toBe(0)
  })

  it('prompts immediately when a worker was already waiting at registration time', () => {
    const registration = fakeRegistration({ waiting: fakeWorker() })
    const container = fakeContainer({})
    let prompts = 0

    watchForUpdate(
      asAny(registration),
      asAny(container),
      () => {
        prompts += 1
      },
      () => {}
    )

    expect(prompts).toBe(1)
  })

  it('does not prompt mid-install, only once state reaches installed', () => {
    const installing = fakeWorker('installing')
    const registration = fakeRegistration({ installing })
    const container = fakeContainer({})
    let prompts = 0

    watchForUpdate(
      asAny(registration),
      asAny(container),
      () => {
        prompts += 1
      },
      () => {}
    )

    registration.emit('updatefound')
    installing.emit('statechange') // still 'installing'

    expect(prompts).toBe(0)
  })

  it('accepting posts SKIP_WAITING and defers the reload to controllerchange', () => {
    const waiting = fakeWorker()
    const registration = fakeRegistration({ waiting })
    const container = fakeContainer({})
    let reloads = 0
    // Collected into an array rather than a `let`: TS's control-flow analysis
    // cannot see that the notifier callback ran, so a nullable local narrows to
    // `never` at the call below.
    const accepts: Array<() => void> = []

    watchForUpdate(
      asAny(registration),
      asAny(container),
      (fn) => {
        accepts.push(fn)
      },
      () => {
        reloads += 1
      }
    )

    accepts[0]?.()

    // The message went out, but reloading now would race skipWaiting() and can
    // land back on the old worker — so nothing has reloaded yet.
    expect(waiting.posted).toEqual([{ type: 'SKIP_WAITING' }])
    expect(reloads).toBe(0)

    container.emit('controllerchange')
    expect(reloads).toBe(1)
  })

  it('reloads directly when accept finds nothing waiting', () => {
    const registration = fakeRegistration({ waiting: fakeWorker() })
    const container = fakeContainer({})
    let reloads = 0
    const accepts: Array<() => void> = []

    watchForUpdate(
      asAny(registration),
      asAny(container),
      (fn) => {
        accepts.push(fn)
      },
      () => {
        reloads += 1
      }
    )

    // The waiting worker activated on its own between prompt and accept.
    registration.waiting = null
    accepts[0]?.()

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

describe('shellIsStale', () => {
  const ENTRY = '/assets/index-NEWHASH.js'
  const shell = (src: string) => async () =>
    new Response(`<!doctype html><script type="module" crossorigin src="${src}"></script>`)

  it('is current when the server shell boots this page’s entry chunk', async () => {
    expect(await shellIsStale(ENTRY, shell(ENTRY))).toBe(false)
  })

  it('is stale when the server shell boots a different build', async () => {
    expect(await shellIsStale(ENTRY, shell('/assets/index-NEWERHASH.js'))).toBe(true)
  })

  it('answers stale when it cannot tell — the toast is the safe default', async () => {
    const offline = async (): Promise<Response> => {
      throw new TypeError('Failed to fetch')
    }
    expect(await shellIsStale(ENTRY, offline)).toBe(true)
    expect(await shellIsStale(ENTRY, async () => new Response('', { status: 503 }))).toBe(true)
  })
})

describe('onlyWhenStale', () => {
  it('passes the update through for a page older than the server', async () => {
    const accepts: Array<() => void> = []
    const notify = onlyWhenStale(
      (accept) => accepts.push(accept),
      async () => true
    )
    const accept = () => {}

    notify(accept)
    await Promise.resolve()
    await Promise.resolve()

    expect(accepts).toEqual([accept])
  })

  it('stays quiet for a page that already runs the deployed build', async () => {
    // Network-first navigations mean a page loaded after a deploy IS the new
    // version; "a new version is ready" would be false, and would greet every
    // returning visitor after every deploy.
    let prompts = 0
    const notify = onlyWhenStale(
      () => {
        prompts += 1
      },
      async () => false
    )

    notify(() => {})
    await Promise.resolve()
    await Promise.resolve()

    expect(prompts).toBe(0)
  })
})
