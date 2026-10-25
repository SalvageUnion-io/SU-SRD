import { describe, expect, test } from 'bun:test'
import { presentMembers } from '../presence'

describe('presentMembers', () => {
  test('a member is here once however many seats they hold open', () => {
    expect(
      presentMembers([
        ['b', 'seat'],
        ['a', 'seat'],
        ['b', 'seat'],
      ])
    ).toEqual(['a', 'b'])
  })

  test('a watcher is not here', () => {
    expect(presentMembers([['a', 'watch'], ['b', 'seat'], []])).toEqual(['b'])
  })
})
