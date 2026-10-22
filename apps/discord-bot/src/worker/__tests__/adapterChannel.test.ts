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

  test('no channel object: the id alone, and no name', () => {
    const interaction = execute({ channel_id: '123' })
    expect(interaction.channelId).toBe('123')
    expect(interaction.channelName).toBeNull()
  })
})
