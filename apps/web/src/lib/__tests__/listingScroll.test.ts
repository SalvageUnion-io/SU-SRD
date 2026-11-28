/**
 * Back to a listing lands on the row the reader left, once the listing's own
 * rows are in place (r3 C1).
 */
import { describe, expect, test } from 'bun:test'
import { keepListingScroll } from '../listingScroll'

function fakeWindow(type: 'navigate' | 'back_forward', state: unknown, scrollY: number) {
  const listeners = new Map<string, () => void>()
  const win = {
    scrollY,
    scrolledTo: undefined as number | undefined,
    history: {
      state,
      replaceState(next: unknown) {
        win.history.state = next
      },
    },
    performance: { getEntriesByType: () => [{ type }] },
    scrollTo(_x: number, y: number) {
      win.scrolledTo = y
    },
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  }
  return { win, listeners }
}

type Win = Parameters<typeof keepListingScroll>[0]

describe('keepListingScroll', () => {
  test('leaving the page writes the position into the entry, keeping its state', () => {
    const { win, listeners } = fakeWindow('navigate', { suPeek: true }, 0)
    keepListingScroll(win as unknown as Win)
    expect(win.scrolledTo).toBeUndefined()
    win.scrollY = 1112
    listeners.get('pagehide')?.()
    expect(win.history.state).toEqual({ suPeek: true, suListingY: 1112 })
  })

  test('a Back visit the browser stopped short of is put where it was left', () => {
    const { win } = fakeWindow('back_forward', { suListingY: 8000 }, 4936)
    keepListingScroll(win as unknown as Win)
    expect(win.scrolledTo).toBe(8000)
  })

  test('a Back visit already in place is left alone', () => {
    const { win } = fakeWindow('back_forward', { suListingY: 1112 }, 1112)
    keepListingScroll(win as unknown as Win)
    expect(win.scrolledTo).toBeUndefined()
  })

  test('a fresh visit or a reload never jumps, whatever the entry holds', () => {
    const { win } = fakeWindow('navigate', { suListingY: 900 }, 0)
    keepListingScroll(win as unknown as Win)
    expect(win.scrolledTo).toBeUndefined()
  })

  test('its teardown stops listening', () => {
    const { win, listeners } = fakeWindow('navigate', null, 0)
    keepListingScroll(win as unknown as Win)()
    expect(listeners.size).toBe(0)
  })
})
