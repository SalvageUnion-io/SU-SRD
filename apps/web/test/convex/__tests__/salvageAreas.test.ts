import { describe, expect, test } from 'bun:test'
import { api } from '../../../convex/_generated/api'
import type { Ctx } from '../fixtures'
import { addPilot, makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * The area a table is salvaging (Core Book p.245): the Mediator sets it, the
 * crew reads it, and each Area Salvage roll spends 1 Supply on the server, so
 * an area runs out once and only once.
 */

async function seedTable(t: Ctx) {
  const gm = await makeUser(t, 'Mediator')
  const a = await makeUser(t, 'Ash')
  const b = await makeUser(t, 'Bex')
  const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await gm.as.mutation(api.invites.link, { gameId })
  await a.as.mutation(api.invites.redeem, { code })
  await b.as.mutation(api.invites.redeem, { code })
  await gm.as.mutation(api.games.setMediator, { gameId, userId: gm.userId, mediator: true })
  await addPilot(a, 'pa', gameId)
  await addPilot(b, 'pb', gameId)
  return { gm, a, b, gameId }
}

const CAMP = { name: 'Raider Camp', techLevel: 1, supply: 2 }

describe("a Game's area", () => {
  test('the Mediator sets it and every member reads it', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    expect(await a.as.query(api.salvageAreas.here, { gameId })).toBeNull()
    await gm.as.mutation(api.salvageAreas.set, { gameId, area: CAMP })
    expect(await a.as.query(api.salvageAreas.here, { gameId })).toEqual(CAMP)
  })

  test('a player cannot set it', async () => {
    const t = testConvex()
    const { a, gameId } = await seedTable(t)
    await expect(a.as.mutation(api.salvageAreas.set, { gameId, area: CAMP })).rejects.toThrow(
      /mediator/i
    )
  })

  test('each roll spends 1 Supply, and a picked-clean area refuses the next', async () => {
    const t = testConvex()
    const { gm, a, b, gameId } = await seedTable(t)
    await gm.as.mutation(api.salvageAreas.set, { gameId, area: CAMP })
    expect(await a.as.mutation(api.salvageAreas.spend, { gameId, pilotId: 'pa' })).toEqual({
      techLevel: 1,
      supply: 1,
    })
    expect((await b.as.mutation(api.salvageAreas.spend, { gameId, pilotId: 'pb' })).supply).toBe(0)
    await expect(a.as.mutation(api.salvageAreas.spend, { gameId, pilotId: 'pa' })).rejects.toThrow(
      /picked clean/
    )
  })

  test('nobody spends Supply for a pilot they cannot play', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await gm.as.mutation(api.salvageAreas.set, { gameId, area: CAMP })
    await expect(a.as.mutation(api.salvageAreas.spend, { gameId, pilotId: 'pb' })).rejects.toThrow()
  })

  test('with no area there is nothing to spend', async () => {
    const t = testConvex()
    const { a, gameId } = await seedTable(t)
    await expect(a.as.mutation(api.salvageAreas.spend, { gameId, pilotId: 'pa' })).rejects.toThrow(
      /no area/
    )
  })

  test('a Tech Level outside 1 to 6 is refused', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    await expect(
      gm.as.mutation(api.salvageAreas.set, { gameId, area: { ...CAMP, techLevel: 7 } })
    ).rejects.toThrow(/Tech Level/)
  })

  test('clearing it leaves no area', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await gm.as.mutation(api.salvageAreas.set, { gameId, area: CAMP })
    await gm.as.mutation(api.salvageAreas.set, { gameId, area: null })
    expect(await a.as.query(api.salvageAreas.here, { gameId })).toBeNull()
  })
})

describe('a solo table', () => {
  test('its player sets the area and spends it for their own pilot', async () => {
    const t = testConvex()
    const solo = await makeUser(t, 'Solo')
    const other = await makeUser(t, 'Other')
    await addPilot(solo, 'ps', null)
    await solo.as.mutation(api.salvageAreas.set, { gameId: null, area: CAMP })
    expect(await solo.as.query(api.salvageAreas.here, { gameId: null })).toEqual(CAMP)
    expect(await other.as.query(api.salvageAreas.here, { gameId: null })).toBeNull()
    expect(
      (await solo.as.mutation(api.salvageAreas.spend, { gameId: null, pilotId: 'ps' })).supply
    ).toBe(1)
  })
})
