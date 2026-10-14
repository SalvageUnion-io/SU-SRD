import { describe, expect, test } from 'bun:test'
import type { APIInteraction } from 'discord-api-types/v10'
import { ApplicationCommandOptionType, InteractionType } from 'discord-api-types/v10'
import { interactionName } from '../adapter'

const as = (raw: unknown) => raw as APIInteraction

describe('interactionName', () => {
  test('names a subcommand without its option values', () => {
    const raw = as({
      type: InteractionType.ApplicationCommand,
      data: {
        name: 'su',
        options: [
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'lookup',
            options: [{ type: ApplicationCommandOptionType.String, name: 'entry', value: 'Mule' }],
          },
        ],
      },
    })
    expect(interactionName(raw)).toBe('su lookup')
  })

  test('names a grouped subcommand by group and leaf', () => {
    const raw = as({
      type: InteractionType.ApplicationCommandAutocomplete,
      data: {
        name: 'su',
        options: [
          {
            type: ApplicationCommandOptionType.SubcommandGroup,
            name: 'game',
            options: [{ type: ApplicationCommandOptionType.Subcommand, name: 'bind', options: [] }],
          },
        ],
      },
    })
    expect(interactionName(raw)).toBe('su game bind')
  })

  test('names a button by its action, never its payload', () => {
    const raw = as({
      type: InteractionType.MessageComponent,
      data: { custom_id: 'su:post:14:mech' },
    })
    expect(interactionName(raw)).toBe('su:post')
  })

  test('a ping names nothing', () => {
    expect(interactionName(as({ type: InteractionType.Ping }))).toBeNull()
  })
})
