import { describe, expect, it } from 'bun:test'
import { bindChannel, bindingForGame, soloBinding, unbindChannel } from '../channelBindings'
import { publishGame, testDb } from './d1'

/** Rosa mediates Reclamation; Tam plays in it; Ines is in no Game. */
async function table() {
  const db = testDb()
  await publishGame(db, 'g-1', {
    name: 'Reclamation',
    mediatedBy: 'Rosa',
    members: [
      { discordId: 'rosa', mediator: true, organizer: false },
      { discordId: 'tam', mediator: false, organizer: false },
    ],
  })
  await publishGame(db, 'g-2', {
    name: 'Deep Salvage',
    mediatedBy: 'Tam',
    members: [{ discordId: 'tam', mediator: true, organizer: false }],
  })
  return db
}

const bindGame = (gameId: string | null, channelId = 'c-1', channelName?: string) => ({
  channelId,
  gameId,
  channelName,
})

describe('channel bindings', () => {
  it('binds a Game’s channel for its Mediator, keeping the name without its #', async () => {
    const db = await table()
    expect(await bindChannel(db, 'rosa', bindGame('g-1', 'c-1', '#salvage-run'), 5)).toEqual({
      ok: true,
      binding: {
        channelId: 'c-1',
        channelName: 'salvage-run',
        gameId: 'g-1',
        gameName: 'Reclamation',
      },
      previousChannelId: null,
    })
    expect(await bindingForGame(db, 'g-1')).toMatchObject({ channelId: 'c-1' })
  })

  it('refuses a player who is not the Mediator or Organiser, and a stranger', async () => {
    const db = await table()
    expect(await bindChannel(db, 'tam', bindGame('g-1'))).toMatchObject({ reason: 'forbidden' })
    expect(await bindChannel(db, 'ines', bindGame('g-1'))).toMatchObject({ reason: 'not-found' })
  })

  it('moves a Game to its new channel, naming the old one', async () => {
    const db = await table()
    await bindChannel(db, 'rosa', bindGame('g-1', 'c-1'))
    expect(await bindChannel(db, 'rosa', bindGame('g-1', 'c-2'))).toMatchObject({
      binding: { channelId: 'c-2' },
      previousChannelId: 'c-1',
    })
    expect(db.sqlite.query('select channel_id from channel_bindings').all()).toEqual([
      { channel_id: 'c-2' },
    ])
  })

  it('binds again idempotently, renaming the channel', async () => {
    const db = await table()
    await bindChannel(db, 'rosa', bindGame('g-1', 'c-1', 'old'))
    expect(await bindChannel(db, 'rosa', bindGame('g-1', 'c-1', 'new'))).toMatchObject({
      binding: { channelName: 'new' },
      previousChannelId: null,
    })
  })

  it('keeps a channel another Game holds unless the caller could unbind it', async () => {
    const db = await table()
    await bindChannel(db, 'tam', bindGame('g-2', 'c-1'))
    expect(await bindChannel(db, 'rosa', bindGame('g-1', 'c-1'))).toMatchObject({
      reason: 'forbidden',
    })
    expect(await bindingForGame(db, 'g-2')).toMatchObject({ channelId: 'c-1' })
  })

  it('binds one solo channel per account, managed by that account alone', async () => {
    const db = await table()
    await bindChannel(db, 'ines', bindGame(null, 'c-9'))
    expect(await bindChannel(db, 'ines', bindGame(null, 'c-8'))).toMatchObject({
      previousChannelId: 'c-9',
    })
    expect(await soloBinding(db, 'ines')).toMatchObject({ channelId: 'c-8', gameId: null })
    expect(await unbindChannel(db, 'rosa', 'c-8')).toMatchObject({ reason: 'forbidden' })
    expect(await unbindChannel(db, 'ines', 'c-8')).toMatchObject({
      ok: true,
      unbound: { channelId: 'c-8' },
    })
    expect(await soloBinding(db, 'ines')).toBeNull()
  })

  it('binds in a server only for someone with Manage Channels there', async () => {
    const db = await table()
    expect(
      await bindChannel(db, 'ines', { ...bindGame(null), manageChannels: false })
    ).toMatchObject({ reason: 'forbidden', message: expect.stringContaining('Manage Channels') })
    expect(
      await bindChannel(db, 'rosa', { ...bindGame('g-1'), manageChannels: false })
    ).toMatchObject({ reason: 'forbidden' })
    expect(await soloBinding(db, 'ines')).toBeNull()
    expect(
      await bindChannel(db, 'ines', { ...bindGame(null), manageChannels: true })
    ).toMatchObject({ ok: true })
  })

  it('lets someone with Manage Channels unbind anybody’s channel', async () => {
    const db = await table()
    await bindChannel(db, 'ines', bindGame(null, 'c-9'))
    await bindChannel(db, 'rosa', bindGame('g-1', 'c-1'))
    expect(await unbindChannel(db, 'tam', 'c-9', false)).toMatchObject({ reason: 'forbidden' })
    expect(await unbindChannel(db, 'tam', 'c-1', false)).toMatchObject({ reason: 'forbidden' })
    expect(await unbindChannel(db, 'tam', 'c-9', true)).toMatchObject({
      unbound: { channelId: 'c-9' },
    })
    expect(await unbindChannel(db, 'tam', 'c-1', true)).toMatchObject({
      unbound: { channelId: 'c-1', gameId: 'g-1' },
    })
  })

  it('unbinds nothing without failing', async () => {
    const db = await table()
    expect(await unbindChannel(db, 'rosa', 'c-404')).toEqual({ ok: true, unbound: null })
  })
})
