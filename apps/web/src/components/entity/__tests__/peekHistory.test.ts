/**
 * A Peek a press opened holds one history entry (`peekHistory`): Back closes
 * the Peek and stays on the page, a close by any other way steps back over the
 * entry, and a link followed from the open Peek replaces it.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { installPeekHistory } from '../peekHistory'

/** A window's history as a stack the test steps through itself. */
function fakeWindow() {
  const entries: unknown[] = [null]
  let at = 0
  const listeners = new Map<string, Set<EventListener>>()
  const replaced: string[] = []
  const fire = (type: string, event: Event) => {
    for (const listener of listeners.get(type) ?? []) listener(event)
  }
  const pendingBacks: (() => void)[] = []
  const win = {
    document,
    history: {
      get state() {
        return entries[at]
      },
      pushState(state: unknown) {
        entries.splice(at + 1)
        entries.push(state)
        at += 1
      },
      // A traversal lands later, as a browser's does.
      back() {
        pendingBacks.push(() => {
          at -= 1
          fire('popstate', new Event('popstate'))
        })
      },
    },
    location: { replace: (href: string) => replaced.push(href) },
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)?.add(listener)
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener)
    },
  }
  return {
    win: win as unknown as Parameters<typeof installPeekHistory>[0],
    depth: () => at,
    replaced,
    /** The reader's Back. */
    back: () => {
      at -= 1
      fire('popstate', new Event('popstate'))
    },
    /** Land the traversals `history.back()` asked for. */
    settle: () => {
      for (const land of pendingBacks.splice(0)) land()
    },
  }
}

describe('peekHistory', () => {
  let fake: ReturnType<typeof fakeWindow>
  let close: ReturnType<typeof mock>
  let history: ReturnType<typeof installPeekHistory>

  beforeEach(() => {
    fake = fakeWindow()
    close = mock(() => {})
    history = installPeekHistory(fake.win, close)
  })
  afterEach(() => {
    history.uninstall()
    document.body.replaceChildren()
  })

  test('Back closes the open Peek and stays on the page', () => {
    history.opened()
    expect(fake.depth()).toBe(1)
    fake.back()
    expect(close).toHaveBeenCalledTimes(1)
    expect(fake.depth()).toBe(0)
  })

  test('Back with no Peek open is the page’s own', () => {
    fake.back()
    expect(close).not.toHaveBeenCalled()
  })

  test('a Peek closed any other way takes its entry with it', () => {
    history.opened()
    history.closed()
    fake.settle()
    expect(fake.depth()).toBe(0)
    expect(close).not.toHaveBeenCalled()
  })

  test('a second Peek opened before the step back lands keeps one entry, and stays open', () => {
    history.opened()
    history.closed()
    history.opened()
    fake.settle()
    expect(close).not.toHaveBeenCalled()
    expect(fake.depth()).toBe(1)
    fake.back()
    expect(close).toHaveBeenCalledTimes(1)
  })

  test('a link followed from the open Peek replaces the entry', () => {
    const link = document.createElement('a')
    link.href = '/traits/burn/'
    document.body.append(link)
    history.opened()
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    link.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(fake.replaced).toEqual([link.href])
  })

  test('a link followed with no Peek held is left alone', () => {
    const link = document.createElement('a')
    link.href = '/traits/burn/'
    document.body.append(link)
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    link.addEventListener('click', (event) => event.preventDefault())
    link.dispatchEvent(click)
    expect(fake.replaced).toEqual([])
  })
})
