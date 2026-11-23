/** After a create, the new page's heading takes focus (r6 F7). */

import { afterEach, describe, expect, test } from 'bun:test'
import { focusHeadingOnArrival } from '../arrivalFocus'

/** A scheduler the test runs by hand: no real frames are waited on. */
function frames() {
  const queue: (() => void)[] = []
  return {
    schedule: (run: () => void) => void queue.push(run),
    step: () => queue.shift()?.(),
    pending: () => queue.length,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('focusHeadingOnArrival', () => {
  test("waits for the address to change, then focuses the new page's h1", () => {
    let path = '/pilots/new'
    document.body.innerHTML =
      '<main><div class="su-wiz-shell"><h1 tabindex="-1">Step 3 of 4 · Who</h1></div></main>'
    const f = frames()
    focusHeadingOnArrival({ schedule: f.schedule, path: () => path })
    f.step()
    // Still on the wizard: its step heading is never the one.
    expect(document.activeElement).toBe(document.body)
    path = '/pilots/abc'
    document.body.innerHTML = '<main><h1>GHOST · Mara Voss</h1></main>'
    f.step()
    const h1 = document.querySelector('h1')
    expect(document.activeElement).toBe(h1)
    expect(h1?.getAttribute('tabindex')).toBe('-1')
    expect(f.pending()).toBe(0)
  })

  test('gives up when no heading arrives', () => {
    const f = frames()
    focusHeadingOnArrival({ schedule: f.schedule, path: () => '/mechs/new' })
    for (let i = 0; i < 200 && f.pending() > 0; i++) f.step()
    expect(f.pending()).toBe(0)
    expect(document.activeElement).toBe(document.body)
  })
})
