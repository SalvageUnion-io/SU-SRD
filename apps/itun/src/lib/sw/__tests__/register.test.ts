/**
 * Service worker registration + update-prompt tests.
 *
 * `registerServiceWorker()` itself is only smoke-testable: `import.meta.env.DEV`
 * is true in Bun's test runner and happy-dom leaves `navigator.serviceWorker`
 * undefined, so both guards fire before the register call. The part that
 * actually carries risk — deciding *when* an update is ready and how it is
 * activated — is `watchForUpdate`, which takes only the slice of the SW API it
 * uses so a plain object can stand in.
 */
import { describe, expect, it } from 'bun:test'
import { registerServiceWorker, watchForUpdate } from '../register'

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
