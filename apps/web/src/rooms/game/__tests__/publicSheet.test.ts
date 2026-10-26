import { describe, expect, test } from 'bun:test'
import { runAct } from '../acts'
import { AT, bodies, MEDIATOR, ORGANIZER, PLAYER, STRANGER, table } from './harness'

/** Sharing a Game's unit by link (ADR-032): `publicSheet.setPublic`, as on Convex. */

function game() {
  const made = table()
  const { room } = made
  room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
  room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
  return made
}

const share = (room: ReturnType<typeof table>['room'], actor: string, appId: string, on: boolean) =>
  runAct({ room, actor, gameId: 'g1', at: AT }, 'publicSheet.setPublic', {
    kind: appId.startsWith('c') ? 'crawler' : 'pilot',
    appId,
    isPublic: on,
  })

describe('publicSheet.setPublic in a Game', () => {
  test('a holder shares their own unit; nobody else may', () => {
    const { room } = game()
    expect(share(room, ORGANIZER, 'p1', true)).toMatchObject({ ok: false })
    expect(share(room, PLAYER, 'p1', true)).toEqual({ ok: true, value: true })
    expect(room.store.unit('p1')?.publicRead).toBe(true)
  })

  test("a crawler is the table runner's to share", () => {
    const { room } = game()
    expect(share(room, PLAYER, 'c1', true)).toMatchObject({ ok: false })
    expect(share(room, MEDIATOR, 'c1', true)).toEqual({ ok: true, value: true })
  })

  test('an unassigned unit cannot be shared, but any member can take its link down', () => {
    const { room } = game()
    share(room, PLAYER, 'p1', true)
    room.units.unassign(PLAYER, 'p1', AT)
    expect(share(room, PLAYER, 'p1', true)).toMatchObject({ ok: false })
    expect(share(room, ORGANIZER, 'p1', false)).toEqual({ ok: true, value: false })
    expect(share(room, STRANGER, 'p1', false)).toMatchObject({ ok: false })
  })
})
