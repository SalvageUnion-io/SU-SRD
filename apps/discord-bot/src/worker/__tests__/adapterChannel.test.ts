import { describe, expect, test } from 'bun:test'
import { InteractionType } from 'discord-api-types/v10'
import { makeExecuteInteraction } from '../adapter'

/**
 * The channel a slash command ran in, as the adapter reads it off the raw
 * interaction: `/su bind` keeps its id and its name, so Play can show
 * `#salvage-run` rather than a generic "Game channel".
 */

type Context = Parameters<typeof makeExecuteInteraction>[0]

function execute(raw: Record<string, unknown>) {
  const ctx = {
    raw: {
      id: '2',
      application_id: 'app',
      type: InteractionType.ApplicationCommand,
      token: 'interaction-token',
      member: { user: { id: 'u1' } },
      data: { id: 'cmd', name: 'su', type: 1, options: [{ name: 'bind', type: 1 }] },
      ...raw,
    },
    applicationId: 'app',
    rest: {},
    sink: {},
  } as unknown as Context
  return makeExecuteInteraction(ctx)
}

describe('the channel a command ran in', () => {
  test('its id and its name, from the partial channel Discord sends', () => {
    const interaction = execute({
      channel_id: '123',
      channel: { id: '123', name: 'salvage-run', type: 0 },
    })
    expect(interaction.channelId).toBe('123')
    expect(interaction.channelName).toBe('salvage-run')
  })

  test('its category and server, for the Game binding that covers the category', () => {
    const interaction = execute({
      channel_id: '123',
      guild_id: '900',
      channel: { id: '123', name: 'salvage-run', type: 0, parent_id: '456' },
    })
    expect(interaction.categoryId).toBe('456')
    expect(interaction.guildId).toBe('900')
    const dm = execute({ channel_id: '123' })
    expect(dm.categoryId).toBeNull()
    expect(dm.guildId).toBeNull()
  })

  test('Manage Channels, from the member’s resolved permissions', () => {
    const member = (permissions: string) => ({ user: { id: 'u1' }, permissions })
    expect(execute({ member: member('16') }).manageChannels).toBe(true)
    expect(execute({ member: member('8') }).manageChannels).toBe(true) // Administrator
    expect(execute({ member: member('2048') }).manageChannels).toBe(false)
    expect(execute({ member: member('not a number') }).manageChannels).toBe(false)
    expect(execute({ member: undefined, user: { id: 'u1' } }).manageChannels).toBeNull()
  })

  test('no channel object: the id alone, and no name', () => {
    const interaction = execute({ channel_id: '123' })
    expect(interaction.channelId).toBe('123')
    expect(interaction.channelName).toBeNull()
  })
})

describe('launching the Activity', () => {
  test('is the initial response, LAUNCH_ACTIVITY with no data', async () => {
    const sent: unknown[] = []
    const ctx = {
      raw: {
        id: '2',
        application_id: 'app',
        type: InteractionType.ApplicationCommand,
        token: 'interaction-token',
        member: { user: { id: 'u1' } },
        data: { id: 'cmd', name: 'su', type: 1, options: [{ name: 'play', type: 1 }] },
      },
      applicationId: 'app',
      rest: {},
      sink: { settled: false, send: (r: unknown) => sent.push(r) },
    } as unknown as Context
    await makeExecuteInteraction(ctx).launchActivity()
    expect(sent).toEqual([{ type: 12 }])
  })
})
