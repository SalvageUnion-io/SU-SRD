import { describe, expect, test } from 'bun:test'
import { mechMaxima, pilotMaxima } from 'game-domain/rules/crewStatus'
import { MechSchema } from 'game-domain/schemas/mech'
import { PilotSchema } from 'game-domain/schemas/pilot'
import { seedShelf } from '../account/__tests__/seedShelf'
import { AccountRoomLogic } from '../account/accountRoomLogic'
import { AT, bodies, PLAYER, stubApplyOp } from '../game/__tests__/harness'
import { migrate } from '../migrate'
import { ACCOUNT_ROOM } from '../schemas'
import { unitVitals } from '../vitals'
import { bunSql } from './bunSql'

/** A Shelf holding pilot p1, ejected and boarded in mech m1 which they fly, and crawler c1. */
function shelf() {
  const sql = bunSql()
  migrate(sql, ACCOUNT_ROOM)
  const room = new AccountRoomLogic(sql, { applyOp: stubApplyOp, newId: () => 'id' })
  const unit = (kind: 'pilot' | 'mech' | 'crawler', id: string) => ({
    kind,
    id,
    body: bodies[kind](id) as Record<string, unknown>,
  })
  seedShelf(
    room,
    {
      owner: PLAYER,
      units: [unit('pilot', 'p1'), unit('mech', 'm1'), unit('crawler', 'c1')],
      links: [
        {
          type: 'mech-to-pilot',
          from: { type: 'mech', id: 'm1' },
          to: { type: 'pilot', id: 'p1' },
        },
      ],
      seats: [
        { pilotId: 'p1', mount: { kind: 'boarded', mechId: 'm1' }, range: 'Far', ejected: true },
      ],
    },
    AT
  )
  return room.shelf.store
}

describe('unitVitals', () => {
  test('derives a pilot’s maxima, with their seat’s ejection', async () => {
    const { maxHP, maxAP } = pilotMaxima(PilotSchema.parse(bodies.pilot('p1')), null)
    expect(await unitVitals(shelf(), 'p1')).toMatchObject({
      kind: 'pilot',
      maxHP,
      maxAP,
      status: { ejected: true },
      attention: true,
    })
  })

  test('derives a mech’s maxima from the pilot flying it', async () => {
    const mech = MechSchema.parse(bodies.mech('m1'))
    const pilot = PilotSchema.parse(bodies.pilot('p1'))
    const { maxSP, maxEP, maxHeat } = mechMaxima(mech, pilot.abilities, [])
    expect(await unitVitals(shelf(), 'm1')).toMatchObject({ kind: 'mech', maxSP, maxEP, maxHeat })
  })

  test('answers null for a crawler and for a unit the room does not hold', async () => {
    const store = shelf()
    expect(await unitVitals(store, 'c1')).toBeNull()
    expect(await unitVitals(store, 'nope')).toBeNull()
  })
})
