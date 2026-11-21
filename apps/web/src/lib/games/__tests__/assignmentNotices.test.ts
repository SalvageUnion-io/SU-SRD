/**
 * MD-23: a player whose pilot or mech is unassigned or handed on by the table
 * runner is told, at once, instead of finding the sheet read-only.
 */

import { describe, expect, test } from 'bun:test'
import { assignmentNotices, handedBack } from '../assignmentNotices'

const held = (owner: string | null, name = 'Sparrow', kind: 'pilot' | 'mech' = 'pilot') => ({
  kind,
  id: 'p1',
  name,
  owner,
})

describe('what a player is told when an assignment leaves them', () => {
  test('unassigned by somebody else: it says so, and what they can still do', () => {
    expect(assignmentNotices([held('u-me')], [held(null)], 'u-me')).toEqual([
      'Sparrow is no longer assigned to you: whoever runs the table unassigned it. You can still read it.',
    ])
  })

  test('handed to a crewmate', () => {
    expect(assignmentNotices([held('u-me')], [held('u-other')], 'u-me')).toEqual([
      'Sparrow is now assigned to a crewmate. You can still read it.',
    ])
  })

  test('nothing for what was never theirs, what is still theirs, or what left the Game', () => {
    expect(assignmentNotices([held('u-other')], [held(null)], 'u-me')).toEqual([])
    expect(assignmentNotices([held('u-me')], [held('u-me')], 'u-me')).toEqual([])
    expect(assignmentNotices([held('u-me')], [], 'u-me')).toEqual([])
    expect(assignmentNotices([held('u-me')], [held(null)], null)).toEqual([])
  })

  test('nothing for one they handed back themselves', () => {
    handedBack('p1')
    expect(assignmentNotices([held('u-me')], [held(null)], 'u-me')).toEqual([])
    // Once: the next time it is taken from them, they are told.
    expect(assignmentNotices([held('u-me')], [held(null)], 'u-me')).toHaveLength(1)
  })

  test('a hand-back the room refused is not remembered', () => {
    handedBack('p1')()
    expect(assignmentNotices([held('u-me')], [held(null)], 'u-me')).toHaveLength(1)
  })
})
