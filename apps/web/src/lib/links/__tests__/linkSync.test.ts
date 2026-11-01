/** A served link as the local record it becomes (ADR-037). */

import { describe, expect, test } from 'bun:test'
import type { LinkShape } from 'game-domain/links/linkRules'
import { softLinkOf } from '../linkSync'

function served(slot?: LinkShape['slot']): LinkShape {
  return {
    from: { type: 'npc', id: 'n1' },
    to: { type: 'crawler', id: 'c1' },
    type: 'npc-to-crawler',
    ...(slot === undefined ? {} : { slot }),
  }
}

describe('softLinkOf', () => {
  test('keys the record by its type and ends, and keeps no date it does not have', () => {
    expect(softLinkOf(served())).toEqual({
      id: 'npc-to-crawler:n1:c1',
      from: { type: 'npc', id: 'n1' },
      to: { type: 'crawler', id: 'c1' },
      type: 'npc-to-crawler',
    })
  })

  test('carries a crew slot only when the link has one', () => {
    const slot = { kind: 'bay' as const, bayRef: 'command' }
    expect(softLinkOf(served(slot)).slot).toEqual(slot)
    expect('slot' in softLinkOf(served())).toBe(false)
  })
})
