/**
 * A unit made or deleted, and a link drawn or removed, are acts on the room
 * the unit lives in: its Game's, or the account room for the Shelf. With no
 * room open to take one, the write fails as offline rather than vanishing.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { acceptingRooms, roomActs, roomAnswer } from '../../../test/roomsStub'
import { pilotFixture } from '../../components/__tests__/fixtures'
import { sendLink, sendRow } from '../outbox'
import { resetSync, setSyncStatus, WritesBlockedOffline } from '../sync'
import { useUnits } from '../units'
import { resetStores } from './resetStores'

beforeEach(async () => {
  resetStores()
  acceptingRooms()
  await useUnits.getState().adopt('pilot', pilotFixture({ id: 'gp', gameId: 'g1' }))
  setSyncStatus('live')
})

afterEach(() => {
  acceptingRooms()
  resetSync()
})

const FROM = { type: 'pilot', id: 'gp' } as const
const TO = { type: 'mech', id: 'gm' } as const
const LINK = { id: 'l1', type: 'pilot-to-mech', from: FROM, to: TO } as never

describe('units, through their rooms', () => {
  test('a create is made at seq 0 in its Game’s room; a delete removes it', async () => {
    const applied = await sendRow('pilot', {
      kind: 'upsert',
      appId: 'p2',
      gameId: 'g1',
      body: { id: 'p2' },
    })
    expect(applied).toEqual({ version: 0, headSeq: 0 })
    await sendRow('mech', { kind: 'delete', appId: 'm1', gameId: null })
    expect(roomActs).toEqual([
      { gameId: 'g1', name: 'createUnit', args: { id: 'p2', kind: 'pilot', body: { id: 'p2' } } },
      { gameId: null, name: 'removeUnit', args: { unitId: 'm1' } },
    ])
  })

  test('a link is wired by the room holding its from end', async () => {
    await sendLink('upsert', LINK)
    await sendLink('delete', LINK)
    expect(roomActs.map((a) => [a.gameId, a.name])).toEqual([
      ['g1', 'drawLink'],
      ['g1', 'removeLink'],
    ])
    expect(roomActs[0]?.args).toEqual({
      link: { from: FROM, to: TO, type: 'pilot-to-mech' },
    })
  })

  test('with no room open, a write fails as offline', async () => {
    roomAnswer.open = false
    await expect(
      sendRow('pilot', { kind: 'delete', appId: 'gp', gameId: 'g1' })
    ).rejects.toBeInstanceOf(WritesBlockedOffline)
    await expect(sendLink('upsert', LINK)).rejects.toBeInstanceOf(WritesBlockedOffline)
    expect(roomActs).toEqual([])
  })

  test('off live, nothing is sent', async () => {
    resetSync()
    await sendRow('pilot', { kind: 'delete', appId: 'gp', gameId: 'g1' })
    await sendLink('upsert', LINK)
    expect(roomActs).toEqual([])
  })
})
