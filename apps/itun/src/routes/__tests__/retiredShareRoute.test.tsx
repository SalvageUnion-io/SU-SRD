/**
 * The retired `/sheet/:kind/:id/share` URL must land on that entity's live
 * sheet, not on the not-found page.
 *
 * The Share Snapshot screen was removed in #793. Anyone who bookmarked the URL,
 * or pasted it to themselves, still has it — and the builder is exactly the kind
 * of app where people keep a tab pinned for a season.
 *
 * `beforeLoad` is called directly rather than through a router: the assertion is
 * about where this route sends you and with which params, which is the whole of
 * its behaviour.
 */

import { describe, expect, test } from 'bun:test'
import { Route } from '../sheet/$kind/$id_.share'

/**
 * What `redirect()` actually throws: the options are NESTED under `.options`,
 * not spread onto the thrown object. Asserting the flat shape passes `toBe`
 * nothing and fails confusingly, so it is spelled out here.
 */
type RedirectThrow = {
  options: {
    to: string
    params: { kind: string; id: string }
    replace?: boolean
  }
}

function redirectFor(kind: string, id: string): RedirectThrow {
  const beforeLoad = Route.options.beforeLoad
  if (typeof beforeLoad !== 'function') throw new Error('route has no beforeLoad')
  try {
    // biome-ignore lint/suspicious/noExplicitAny: exercising one field of the router's ctx
    beforeLoad({ params: { kind, id } } as any)
  } catch (thrown) {
    return thrown as RedirectThrow
  }
  throw new Error('beforeLoad did not redirect')
}

describe('retired /sheet/:kind/:id/share', () => {
  test.each([
    ['pilot', 'pilot-1'],
    ['mech', '0246f9a3-84db-4968-b295-4cc8b6b2c2f5'],
    ['crawler', 'crawler-9'],
  ])('redirects a %s to its live sheet', (kind, id) => {
    const { options } = redirectFor(kind, id)
    expect(options.to).toBe('/sheet/$kind/$id')
    expect(options.params).toEqual({ kind, id })
  })

  /**
   * Without `replace`, Back would return to the retired URL and bounce forward
   * again — the reader would be unable to leave by the obvious route.
   */
  test('replaces rather than pushes, so Back still works', () => {
    expect(redirectFor('mech', 'mech-1').options.replace).toBe(true)
  })
})
