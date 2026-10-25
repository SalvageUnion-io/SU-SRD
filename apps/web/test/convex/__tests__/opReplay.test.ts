import { describe, expect, test } from 'bun:test'
import { api } from '../../../convex/_generated/api'
import { STALE_WRITE_REFUSAL } from '../../../convex/model/staleWrite'
import { addPilot, opRow, seedTable, unitOp } from '../fixtures'
import { testConvex } from '../harness'

/**
 * `ops.replay`: an op an outbox sends on reconnect (ADR-063). It lands as
 * `ops.apply` would; one the server refuses is kept `declined`, with why, and
 * answered rather than thrown, so the rest of the outbox still goes.
 */

async function pilotOnServer(t: ReturnType<typeof testConvex>, appId: string) {
  return await t.run(
    async (ctx) =>
      await ctx.db
        .query('pilots')
        .filter((q) => q.eq(q.field('appId'), appId))
        .first()
  )
}

describe('ops.replay', () => {
  test('applies an op made offline', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await addPilot(player, 'p1', gameId)

    const answer = await player.as.mutation(
      api.ops.replay,
      unitOp('pilot', { appId: 'p1', gameId, patch: { callsign: 'Offline' }, id: 'op-a' })
    )

    expect(answer).toMatchObject({ fresh: true })
    expect((await pilotOnServer(t, 'p1'))?.body).toMatchObject({ callsign: 'Offline' })
    expect((await opRow(t, 'op-a'))?.state).toBe('applied')
  })

  test('keeps a refused op declined, with why, and answers it', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await addPilot(player, 'p1', gameId)
    // Another device changed the callsign after the offline copy was taken.
    await player.as.mutation(
      api.ops.apply,
      unitOp('pilot', { appId: 'p1', gameId, patch: { callsign: 'Elsewhere' }, id: 'op-b' })
    )

    const answer = await player.as.mutation(
      api.ops.replay,
      unitOp('pilot', {
        appId: 'p1',
        gameId,
        patch: { callsign: 'Offline' },
        baseSeq: 0,
        id: 'op-c',
      })
    )

    expect(answer).toEqual({ declined: STALE_WRITE_REFUSAL })
    expect((await pilotOnServer(t, 'p1'))?.body).toMatchObject({ callsign: 'Elsewhere' })
    const kept = await opRow(t, 'op-c')
    expect(kept).toMatchObject({ state: 'declined', seq: null, reason: STALE_WRITE_REFUSAL })

    // A second send of the same op changes nothing: it was answered once.
    expect(
      await player.as.mutation(
        api.ops.replay,
        unitOp('pilot', {
          appId: 'p1',
          gameId,
          patch: { callsign: 'Offline' },
          baseSeq: 0,
          id: 'op-c',
        })
      )
    ).toMatchObject({ fresh: false })
  })

  test('declines an op on a sheet that is not yours', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await addPilot(player, 'p1', gameId)

    const answer = await organizer.as.mutation(
      api.ops.replay,
      unitOp('pilot', { appId: 'p1', gameId, patch: { callsign: 'Theirs' }, id: 'op-d' })
    )

    expect(answer).toHaveProperty('declined')
    expect((await pilotOnServer(t, 'p1'))?.body).toMatchObject({ callsign: 'p1' })
    expect((await opRow(t, 'op-d'))?.state).toBe('declined')
  })
})
