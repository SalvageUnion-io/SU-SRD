/** A served link as the local record it becomes (ADR-037). */

import { describe, expect, test } from 'bun:test'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import type { ServedLink } from '../linkSync'
import { softLinkFromServer } from '../linkSync'

const T0 = Date.parse(FIXTURE_NOW)

function served(slot?: ServedLink['slot']): ServedLink {
  return {
    _id: 'srv-1',
    _creationTime: T0,
    gameId: 'g1',
    from: { type: 'pilot', id: 'p1' },
    to: { type: 'crawler', id: 'c1' },
    type: 'pilot-to-crawler',
    ...(slot === undefined ? {} : { slot }),
  }
}

describe('softLinkFromServer', () => {
  test('keeps the server row id and its ends, created when the row was', () => {
    expect(softLinkFromServer(served())).toEqual({
      id: 'srv-1',
      from: { type: 'pilot', id: 'p1' },
      to: { type: 'crawler', id: 'c1' },
      type: 'pilot-to-crawler',
      createdAt: new Date(T0).toISOString(),
    })
  })

  test('carries a crew slot only when the row has one', () => {
    const slot = { kind: 'bay' as const, bayRef: 'command' }
    expect(softLinkFromServer(served(slot)).slot).toEqual(slot)
    expect('slot' in softLinkFromServer(served())).toBe(false)
  })
})
