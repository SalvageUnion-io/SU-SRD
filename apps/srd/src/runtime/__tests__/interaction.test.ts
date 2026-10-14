/**
 * The `interaction` directive: an island mounts on the reader's first reach
 * for it, and what they did while it loaded is played back on it.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { elementAt, pathTo, replayInteraction, watchInteraction } from '../interaction'

let host: HTMLElement

beforeEach(() => {
  host = document.createElement('div')
  host.innerHTML =
    '<div class="rail">' +
    '<input name="q" />' +
    '<button type="button" data-tl="1">TL 1</button>' +
    '<select><option value="">All</option><option value="core">Core</option></select>' +
    '</div>' +
    '<a href="/chassis/mule/">Mule</a>'
  document.body.appendChild(host)
})

afterEach(() => {
  host.remove()
  ;(document.activeElement as HTMLElement | null)?.blur?.()
})

function q<T extends Element>(selector: string): T {
  const el = host.querySelector<T>(selector)
  if (!el) throw new Error(`no ${selector}`)
  return el
}

/** Swaps the host's markup for an identical copy, as a `createRoot` mount does. */
function redraw(): void {
  const markup = host.innerHTML
  host.innerHTML = markup
}

describe('pathTo / elementAt', () => {
  test('name the same element in an identical redraw', () => {
    const path = pathTo(host, q('button'))
    expect(path).toEqual([0, 1])
    redraw()
    expect(elementAt(host, path ?? [])).toBe(q('button'))
  })

  test('an element outside the root has no path; a path past the markup finds nothing', () => {
    expect(pathTo(host, document.body)).toBeNull()
    const loose = document.createElement('span')
    expect(pathTo(host, loose)).toBeNull()
    expect(elementAt(host, [0, 9])).toBeNull()
    expect(elementAt(host, [])).toBe(host)
  })
})

describe('watchInteraction', () => {
  test('wakes once, on the first reach into the placeholder only', () => {
    let woken = 0
    watchInteraction(host, () => woken++)

    document.body.dispatchEvent(new Event('pointerover', { bubbles: true }))
    expect(woken).toBe(0)

    q('button').dispatchEvent(new Event('pointerover', { bubbles: true }))
    q('input').dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
    expect(woken).toBe(1)
  })

  test('holds a press on a control, and plays it back once the island listens', () => {
    const watch = watchInteraction(host, () => {})
    const press = new MouseEvent('click', { bubbles: true, cancelable: true })
    q('button').dispatchEvent(press)
    expect(press.defaultPrevented).toBe(true)

    redraw()
    let pressed = ''
    q('button').addEventListener('click', (e) => {
      pressed = (e.currentTarget as HTMLElement).dataset.tl ?? ''
    })
    replayInteraction(host, watch.finish())
    expect(pressed).toBe('1')
  })

  test('lets a link be followed: only button-like controls are held', () => {
    const watch = watchInteraction(host, () => {})
    const follow = new MouseEvent('click', { bubbles: true, cancelable: true })
    q('a').dispatchEvent(follow)
    expect(follow.defaultPrevented).toBe(false)
    expect(watch.finish().press).toBeNull()
  })

  test('gives focus back to the same control when the mount dropped it', () => {
    const watch = watchInteraction(host, () => {})
    q<HTMLButtonElement>('button').focus()
    redraw()
    expect(document.activeElement).toBe(document.body)

    replayInteraction(host, watch.finish())
    expect(document.activeElement).toBe(q('button'))
  })

  test('chooses a menu again by position, the way choosing does', () => {
    const watch = watchInteraction(host, () => {})
    const menu = q<HTMLSelectElement>('select')
    menu.value = 'core'
    menu.dispatchEvent(new Event('change', { bubbles: true }))
    // Only the last choice on a menu is kept.
    menu.value = ''
    menu.dispatchEvent(new Event('change', { bubbles: true }))
    menu.value = 'core'
    menu.dispatchEvent(new Event('change', { bubbles: true }))

    redraw()
    const changes: string[] = []
    q('select').addEventListener('change', (e) =>
      changes.push((e.target as HTMLSelectElement).value)
    )
    const pending = watch.finish()
    expect(pending.changes).toHaveLength(1)
    replayInteraction(host, pending)
    expect(changes).toEqual(['core'])
    expect(q<HTMLSelectElement>('select').value).toBe('core')
  })

  test('ignores a change on anything but a menu', () => {
    const watch = watchInteraction(host, () => {})
    q('input').dispatchEvent(new Event('change', { bubbles: true }))
    expect(watch.finish().changes).toEqual([])
  })

  test('stops listening once finished', () => {
    let woken = 0
    const watch = watchInteraction(host, () => woken++)
    watch.finish()
    q('button').dispatchEvent(new Event('pointerover', { bubbles: true }))
    const press = new MouseEvent('click', { bubbles: true, cancelable: true })
    q('button').dispatchEvent(press)
    expect(woken).toBe(0)
    expect(press.defaultPrevented).toBe(false)
  })
})

describe('watchInteraction with a page-wide trigger', () => {
  let trigger: HTMLAnchorElement

  beforeEach(() => {
    trigger = document.createElement('a')
    trigger.href = '/traits/hot/'
    trigger.dataset.peek = 'traits:hot'
    trigger.innerHTML = '<span>Hot</span>'
    document.body.appendChild(trigger)
  })

  afterEach(() => trigger.remove())

  test('wakes on a matching element anywhere in the page, not on the placeholder', () => {
    let woken = 0
    const watch = watchInteraction(host, () => woken++, { trigger: '[data-peek]' })
    q('button').dispatchEvent(new Event('pointerover', { bubbles: true }))
    expect(woken).toBe(0)

    trigger.querySelector('span')?.dispatchEvent(new Event('pointerover', { bubbles: true }))
    expect(woken).toBe(1)
    expect(watch.finish().trigger).toBe(trigger)
  })

  test('never holds a press: a trigger is a link', () => {
    const watch = watchInteraction(host, () => {}, { trigger: '[data-peek]' })
    const follow = new MouseEvent('click', { bubbles: true, cancelable: true })
    trigger.dispatchEvent(follow)
    expect(follow.defaultPrevented).toBe(false)
    watch.finish()
  })

  test('announces focus on the trigger again for a host that missed it', () => {
    const watch = watchInteraction(host, () => {}, { trigger: '[data-peek]' })
    trigger.focus()
    const seen: string[] = []
    document.addEventListener('focusin', (e) => seen.push((e.target as Element).tagName), {
      once: true,
    })
    replayInteraction(host, watch.finish())
    expect(seen).toEqual(['A'])
  })

  test('announces the hover again while the pointer is still on the trigger', () => {
    const watch = watchInteraction(host, () => {}, { trigger: '[data-peek]' })
    trigger.dispatchEvent(new Event('pointerover', { bubbles: true }))
    // happy-dom keeps no pointer, so the trigger says it is hovered.
    const matches = trigger.matches.bind(trigger)
    const hovered = (selector: string) => selector === ':hover' || matches(selector)
    spyOn(trigger, 'matches').mockImplementation(hovered as typeof trigger.matches)
    const seen: string[] = []
    document.addEventListener('pointerover', (e) => seen.push((e.target as Element).tagName), {
      once: true,
    })
    replayInteraction(host, watch.finish())
    expect(seen).toEqual(['A'])
  })

  test('announces nothing for a trigger the reader has left', () => {
    const watch = watchInteraction(host, () => {}, { trigger: '[data-peek]' })
    trigger.dispatchEvent(new Event('focusin', { bubbles: true }))
    const seen: string[] = []
    const listen = (e: Event) => seen.push(e.type)
    document.addEventListener('focusin', listen)
    document.addEventListener('pointerover', listen)
    replayInteraction(host, watch.finish())
    document.removeEventListener('focusin', listen)
    document.removeEventListener('pointerover', listen)
    expect(seen).toEqual([])
  })

  test('announces nothing for a trigger no longer on the page', () => {
    const watch = watchInteraction(host, () => {}, { trigger: '[data-peek]' })
    trigger.dispatchEvent(new Event('pointerover', { bubbles: true }))
    trigger.remove()
    expect(() => replayInteraction(host, watch.finish())).not.toThrow()
  })
})
