/**
 * `client:interaction` on an island whose served markup this visit does not
 * show. A listing is its page's rows, so it mounts at once wherever the
 * reader is on the page: Back restores the scroll far below the listing's
 * first box, and a listing that waited to be seen there never mounted, so
 * the served list came back unfiltered after the pending limit (r3 C1).
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { SHOW_HOMEBREW_KEY } from '../../../lib/homebrew/endpoint'
import interaction from '../interaction'

/** An observer that never reports: the island's first box is out of view. */
class NeverSeen {
  static watched = 0
  observe() {
    NeverSeen.watched += 1
  }
  disconnect() {}
}

const realObserver = globalThis.IntersectionObserver

function mount(name: string, props: Record<string, unknown>): { loads: number } {
  globalThis.IntersectionObserver = NeverSeen as unknown as typeof IntersectionObserver
  const el = document.createElement('astro-island')
  document.body.append(el)
  const counted = { loads: 0 }
  const load = async () => {
    counted.loads += 1
    return async () => {}
  }
  interaction(load, { name: 'interaction', value: { name, props } as never }, el)
  return counted
}

afterEach(() => {
  globalThis.IntersectionObserver = realObserver
  NeverSeen.watched = 0
  document.body.replaceChildren()
  window.location.href = 'http://localhost/'
  window.localStorage.clear()
})

describe('client:interaction', () => {
  test('a listing on a filtered address mounts at once, in view or not', () => {
    window.location.href = 'http://localhost/systems/?tl=3&sort=-damage'
    const counted = mount('SchemaViewerIsland', { schemaId: 'systems' })
    expect(counted.loads).toBe(1)
    expect(NeverSeen.watched).toBe(0)
  })

  test('a chassis’s Homebrew left on still waits to be in view', () => {
    window.localStorage.setItem(SHOW_HOMEBREW_KEY, 'on')
    const counted = mount('HomebrewIsland', {})
    expect(counted.loads).toBe(0)
    expect(NeverSeen.watched).toBe(1)
  })
})
