/**
 * A listing opened on a filtered or sorted address keeps its served rows out
 * of sight from before the first paint (r2 H8): the page's inline script marks
 * `<html>` when the address or the reader's stored view asks for another
 * listing than the one served, and lifts the mark on the island's commit.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { ISLAND_COMMIT } from '../../runtime/islandCommit'
import { listingViewStorageKey } from '../listingParams'
import { LISTING_PENDING_ATTRIBUTE, listingPendingScript } from '../listingPending'

/** Runs the page's script as the parser would; returns the fallback it scheduled. */
function run(): (() => void) | undefined {
  const real = globalThis.setTimeout
  let fallback: (() => void) | undefined
  // The script's one timer is its 4 s fallback: held here, never waited on.
  globalThis.setTimeout = ((handler: () => void) => {
    fallback = handler
    return 0
  }) as unknown as typeof setTimeout
  try {
    new Function(listingPendingScript())()
  } finally {
    globalThis.setTimeout = real
  }
  return fallback
}

const pending = () => document.documentElement.hasAttribute(LISTING_PENDING_ATTRIBUTE)

afterEach(() => {
  document.documentElement.removeAttribute(LISTING_PENDING_ATTRIBUTE)
  window.location.href = 'http://localhost/'
  localStorage.clear()
})

describe('listingPendingScript', () => {
  test('a plain address leaves the served list in sight', () => {
    window.location.href = 'http://localhost/chassis/'
    expect(run()).toBeUndefined()
    expect(pending()).toBe(false)
  })

  test('a filter or a sort in the address holds the rows until the island commits', () => {
    for (const query of ['?tl=3', '?sort=-name', '?trait=Hot', '?view=catalog', '?q=mule']) {
      window.location.href = `http://localhost/chassis/${query}`
      run()
      expect(pending()).toBe(true)
      document.body.dispatchEvent(new Event(ISLAND_COMMIT, { bubbles: true }))
      expect(pending()).toBe(false)
    }
  })

  test('a view the reader chose on an earlier visit holds them too', () => {
    window.location.href = 'http://localhost/chassis/'
    localStorage.setItem(listingViewStorageKey('chassis'), 'catalog')
    window.location.href = 'http://localhost/systems/'
    run()
    expect(pending()).toBe(false)
    window.location.href = 'http://localhost/chassis/'
    run()
    expect(pending()).toBe(true)
  })

  test('an island that never comes: the fallback shows the served list', () => {
    window.location.href = 'http://localhost/chassis/?tl=3'
    const fallback = run()
    expect(pending()).toBe(true)
    fallback?.()
    expect(pending()).toBe(false)
  })
})
