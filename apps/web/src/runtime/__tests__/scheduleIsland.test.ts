/**
 * The `idle` directive must bound its wait: an unbounded `requestIdleCallback`
 * never fires on a main thread that is never idle, and the island never mounts.
 */

import { afterEach, describe, expect, jest, test } from 'bun:test'
import { IDLE_MOUNT_TIMEOUT_MS, schedule } from '../scheduleIsland'

type IdleCall = { callback: () => void; options: IdleRequestOptions | undefined }

const originals = {
  requestIdleCallback: Object.getOwnPropertyDescriptor(window, 'requestIdleCallback'),
  IntersectionObserver: Object.getOwnPropertyDescriptor(window, 'IntersectionObserver'),
}

afterEach(() => {
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(window, key, descriptor)
    else Reflect.deleteProperty(window, key)
  }
})

/** A fake `IntersectionObserver`: records what it observes and lets the test fire entries. */
function installObserver() {
  const instances: {
    callback: (entries: { isIntersecting: boolean }[]) => void
    observed: Element[]
    disconnected: boolean
  }[] = []
  class FakeObserver {
    observed: Element[] = []
    disconnected = false
    callback: (entries: { isIntersecting: boolean }[]) => void
    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
      this.callback = callback
      instances.push(this)
    }
    observe(el: Element) {
      this.observed.push(el)
    }
    disconnect() {
      this.disconnected = true
    }
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: FakeObserver,
  })
  return instances
}

describe('schedule', () => {
  test('an idle island asks for an idle period with a timeout, and mounts in it', () => {
    const calls: IdleCall[] = []
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      writable: true,
      value: (callback: () => void, options?: IdleRequestOptions) => {
        calls.push({ callback, options })
        return calls.length
      },
    })
    let mounted = 0
    schedule('idle', document.createElement('div'), () => {
      mounted++
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.options).toEqual({ timeout: IDLE_MOUNT_TIMEOUT_MS })
    expect(mounted).toBe(0)
    calls[0]?.callback()
    expect(mounted).toBe(1)
  })

  test('a load island mounts at once', () => {
    let mounted = 0
    schedule('load', document.createElement('div'), () => {
      mounted++
    })
    expect(mounted).toBe(1)
  })

  test('an idle island falls back to a short timer where requestIdleCallback is missing', () => {
    Reflect.deleteProperty(window, 'requestIdleCallback')
    jest.useFakeTimers()
    try {
      let mounted = 0
      schedule('idle', document.createElement('div'), () => {
        mounted++
      })
      expect(mounted).toBe(0)
      jest.advanceTimersByTime(200)
      expect(mounted).toBe(1)
    } finally {
      jest.useRealTimers()
    }
  })

  test('a visible island waits until its element intersects, then mounts once and stops observing', () => {
    const observers = installObserver()
    const el = document.createElement('div')
    let mounted = 0
    schedule('visible', el, () => {
      mounted++
    })
    expect(observers).toHaveLength(1)
    const observer = observers[0]
    if (!observer) throw new Error('no observer')
    expect(observer.observed).toEqual([el])
    expect(mounted).toBe(0)

    observer.callback([{ isIntersecting: false }])
    expect(mounted).toBe(0)
    expect(observer.disconnected).toBe(false)

    observer.callback([
      { isIntersecting: false },
      { isIntersecting: true },
      { isIntersecting: true },
    ])
    expect(mounted).toBe(1)
    expect(observer.disconnected).toBe(true)
  })

  test('a visible island mounts at once where IntersectionObserver is missing', () => {
    Reflect.deleteProperty(window, 'IntersectionObserver')
    let mounted = 0
    schedule('visible', document.createElement('div'), () => {
      mounted++
    })
    expect(mounted).toBe(1)
  })

  test('an only island mounts at once', () => {
    let mounted = 0
    schedule('only', document.createElement('div'), () => {
      mounted++
    })
    expect(mounted).toBe(1)
  })
})
