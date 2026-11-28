import { describe, expect, test } from 'bun:test'
import type { GameActArgs, GameActName } from '../acts'
import { runAct } from '../acts'
import { AT, bodies, ORGANIZER, PLAYER, profile, table } from './harness'

/** Rejoining a Game brings back what a removal took (r6 C7): noted in the change log. */

function removedAndBack() {
  const made = table()
  const { room, gameId, code } = made
  room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
  const act = <N extends GameActName>(actor: string, name: N, args: GameActArgs<N>, at = AT) => {
    const before = room.events.before(name, args)
    const answer = runAct({ room, actor, gameId, at }, name, args)
    if (!answer.ok) throw new Error(answer.refusal)
    return {
      value: answer.value,
      events: room.events.after(actor, name, args, answer.value, before, at),
    }
  }
  return { ...made, act, code }
}

describe('rejoining after a removal', () => {
  test('what left is owed on rejoining, comes back once, and the table is told', () => {
    const { room, act, code } = removedAndBack()
    expect(room.roster.leaving(ORGANIZER, PLAYER, AT + 1)).toEqual(['p1'])
    room.roster.forgetMember(PLAYER)
    act(PLAYER, 'redeem', { code, profile: profile('Player') }, AT + 2)
    expect(act(PLAYER, 'returning', undefined as never).value).toEqual({ moved: ['p1'], kept: [] })
    // The Worker hands it back from their Training Bay (`worker/shared/rejoin.ts`).
    if (room.store.unit('p1') === null)
      room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT + 2 })
    const { value, events } = act(PLAYER, 'returned', { moved: ['p1'] }, AT + 3)
    expect(value).toEqual(['p1'])
    expect(events.map((e) => e.text)).toEqual(['Player is back, with p1'])
    expect(act(PLAYER, 'returning', undefined as never).value).toEqual({ moved: [], kept: [] })
  })

  test('leaving of one’s own accord owes nothing', () => {
    const { room, act, code } = removedAndBack()
    room.roster.leaving(PLAYER, PLAYER, AT + 1)
    room.roster.forgetMember(PLAYER)
    act(PLAYER, 'redeem', { code, profile: profile('Player') }, AT + 2)
    expect(act(PLAYER, 'returning', undefined as never).value).toEqual({ moved: [], kept: [] })
  })
})
