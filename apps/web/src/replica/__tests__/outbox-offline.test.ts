/**
 * The outbox (ADR-063 decision 9), the client half: offline, an edit to the
 * player's own sheet is held and waits; a crawler edit or a move is still
 * refused; back live, what waits goes up to its room, one op per unit, and
 * one the room declines is answered with why.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { acceptingRooms, roomAnswer, roomOps } from '../../../test/roomsStub'
import { crawlerFixture, pilotFixture } from '../../components/__tests__/fixtures'

/** Each op the rooms took. */
const sent = () => roomOps.flatMap(({ ops }) => ops)

const { holdGames, RoomDeclined } = await import('../roomSocket')
const { flushOutbox, forgetOutbox } = await import('../outbox')
const { resetSync, setSyncStatus, WritesBlockedOffline } = await import('../sync')
const { useUnits } = await import('../units')
const { resetStores } = await import('./resetStores')

const TXN = { kind: 'manual', source: 'test' } as const

beforeEach(async () => {
  resetStores()
  forgetOutbox()
  acceptingRooms()
  const units = useUnits.getState()
  await units.adopt('pilot', pilotFixture({ id: 'p1', callsign: 'Before', name: 'Before' }))
  await units.adopt('crawler', crawlerFixture({ id: 'c1', name: 'Before' }))
  setSyncStatus('offline')
})

afterEach(() => {
  resetSync()
  forgetOutbox()
  acceptingRooms()
  holdGames(null)
})

describe('offline', () => {
  test('an edit to your own pilot is held, and nothing is sent', async () => {
    await useUnits.getState().update('pilot', 'p1', { callsign: 'Offline' }, TXN)

    expect(useUnits.getState().get('pilot', 'p1')?.callsign).toBe('Offline')
    expect(sent()).toEqual([])
  })

  test('a crawler edit is still refused', async () => {
    await expect(
      useUnits.getState().update('crawler', 'c1', { name: 'Offline' }, TXN)
    ).rejects.toBeInstanceOf(WritesBlockedOffline)
  })

  test('a move is still refused: a container is Game-wide', async () => {
    await expect(
      useUnits.getState().update('pilot', 'p1', { gameId: 'g1' }, TXN)
    ).rejects.toBeInstanceOf(WritesBlockedOffline)
  })
})

describe('back live', () => {
  test('the unit’s edits go up as one replay, and nothing waits after', async () => {
    const units = useUnits.getState()
    await units.update('pilot', 'p1', { callsign: 'One' }, TXN)
    await units.update('pilot', 'p1', { callsign: 'Two', name: 'Renamed' }, TXN)
    setSyncStatus('live')

    expect(await flushOutbox()).toEqual([])
    expect(sent().map((op) => [op.unitId, op.patch.callsign, op.patch.name])).toEqual([
      ['p1', 'Two', 'Renamed'],
    ])
    expect(await flushOutbox()).toEqual([])
    expect(sent()).toHaveLength(1)
  })

  test('a declined op is answered with why', async () => {
    await useUnits.getState().update('pilot', 'p1', { callsign: 'Late' }, TXN)
    roomAnswer.submit = async () => {
      throw new RoomDeclined('That sheet is no longer yours')
    }
    setSyncStatus('live')

    expect(await flushOutbox()).toEqual(['That sheet is no longer yours'])
  })

  test('a call while one is under way tells its refusals once', async () => {
    await useUnits.getState().update('pilot', 'p1', { callsign: 'Late' }, TXN)
    roomAnswer.submit = async () => {
      throw new RoomDeclined('That sheet is no longer yours')
    }
    setSyncStatus('live')

    const [first, second] = await Promise.all([flushOutbox(), flushOutbox()])
    expect(first).toEqual(['That sheet is no longer yours'])
    expect(second).toEqual([])
  })

  test('each op goes up marked as replayed, so the room takes it only on your own units', async () => {
    await useUnits.getState().update('pilot', 'p1', { callsign: 'Offline' }, TXN)
    setSyncStatus('live')
    await flushOutbox()
    expect(roomOps.map((batch) => batch.replayed)).toEqual([true])
  })

  test('an edit made while its op is in flight goes up as an op of its own', async () => {
    const units = useUnits.getState()
    await units.update('pilot', 'p1', { callsign: 'First' }, TXN)
    setSyncStatus('live')
    // The room applies the first op, but its answer never arrives: offline again.
    let editDuringSend: Promise<unknown> = Promise.resolve()
    roomAnswer.submit = async () => {
      setSyncStatus('offline')
      editDuringSend = units.update('pilot', 'p1', { name: 'Second' }, TXN)
      await editDuringSend
      throw new Error('Connection lost')
    }
    await flushOutbox()
    await editDuringSend

    acceptingRooms()
    setSyncStatus('live')
    await flushOutbox()
    // Folded into the first, the second edit would carry its id, which the room skips.
    const [first, second] = sent()
    expect(first?.patch).toMatchObject({ callsign: 'First' })
    expect(first?.patch.name).toBeUndefined()
    expect(second?.patch).toMatchObject({ name: 'Second' })
    expect(second?.id).not.toBe(first?.id)
  })

  test('an op for a Game whose room is not open waits without holding up the rest', async () => {
    const units = useUnits.getState()
    await units.adopt('pilot', pilotFixture({ id: 'p2', callsign: 'Away', gameId: 'g-gone' }))
    await units.update('pilot', 'p2', { callsign: 'Stuck' }, TXN)
    await units.update('pilot', 'p1', { callsign: 'Shelf' }, TXN)
    roomAnswer.open = (gameId) => gameId !== 'g-gone'
    setSyncStatus('live')

    expect(await flushOutbox()).toEqual([])
    expect(sent().map((op) => op.patch.callsign)).toEqual(['Shelf'])

    acceptingRooms()
    await flushOutbox()
    expect(sent().map((op) => op.patch.callsign)).toEqual(['Stuck'])
  })

  test('an op for a Game the player is no longer in is told as declined, and dropped', async () => {
    const units = useUnits.getState()
    await units.adopt('pilot', pilotFixture({ id: 'p2', callsign: 'Away', gameId: 'g-gone' }))
    await units.update('pilot', 'p2', { callsign: 'Lost' }, TXN)
    await units.update('pilot', 'p1', { callsign: 'Shelf' }, TXN)
    roomAnswer.open = (gameId) => gameId !== 'g-gone'
    holdGames(['g-other'])
    setSyncStatus('live')

    expect(await flushOutbox()).toEqual(['its Game has ended, or you are no longer in it'])
    expect(sent().map((op) => op.patch.callsign)).toEqual(['Shelf'])

    acceptingRooms()
    expect(await flushOutbox()).toEqual([])
    expect(sent()).toEqual([])
  })

  test('a send that fails keeps the op for next time', async () => {
    await useUnits.getState().update('pilot', 'p1', { callsign: 'Kept' }, TXN)
    setSyncStatus('live')
    roomAnswer.submit = async () => {
      throw new Error('Connection lost')
    }
    expect(await flushOutbox()).toEqual([])

    acceptingRooms()
    expect(await flushOutbox()).toEqual([])
    expect(sent().map((op) => op.patch.callsign)).toEqual(['Kept'])
  })
})
