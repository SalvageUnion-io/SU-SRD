/**
 * The `idle` directive must bound its wait: an unbounded `requestIdleCallback`
 * never fires on a main thread that is never idle, and the island never mounts.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { IDLE_MOUNT_TIMEOUT_MS, schedule } from '../scheduleIsland'

type IdleCall = { callback: () => void; options: IdleRequestOptions | undefined }

const original = Object.getOwnPropertyDescriptor(window, 'requestIdleCallback')

afterEach(() => {
  if (original) Object.defineProperty(window, 'requestIdleCallback', original)
  else Reflect.deleteProperty(window, 'requestIdleCallback')
})

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
})
