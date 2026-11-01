import { describe, expect, test } from 'bun:test'
import { presentMembers, seatOf } from '../presence'

describe('presentMembers', () => {
  test('a member is here once however many seated sockets they hold open', () => {
    expect(
      presentMembers([
        { member: 'b', here: true },
        { member: 'a', here: true },
        { member: 'b', here: true },
      ])
    ).toEqual(['a', 'b'])
  })

  test('a socket that never sat, or stood, is not here', () => {
    expect(
      presentMembers([
        { member: 'a', here: false },
        { member: 'b', here: true },
        { member: undefined, here: true },
      ])
    ).toEqual(['b'])
  })
})

describe('seatOf', () => {
  test('reads a socket’s attachment: only a seat that says here is', () => {
    expect(seatOf({ here: true })).toBe(true)
    expect(seatOf({ here: false })).toBe(false)
    expect(seatOf(null)).toBe(false)
  })
})
