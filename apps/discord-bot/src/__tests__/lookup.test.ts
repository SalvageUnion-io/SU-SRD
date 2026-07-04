/**
 * `/su lookup` handler tests — execute + autocomplete against mock
 * interactions.
 *
 * The branches that matter: an autocomplete-selected `schemaName::slug` value
 * resolves to the exact entity and deep-links its salvageunion.io page; a
 * free-typed query falls back to the top search hit; a no-match query yields
 * the ephemeral "not found" reply. Autocomplete short-circuits empty input
 * and otherwise emits `schemaName::slug` choice values.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord.js'
import { SalvageUnionReference } from 'salvageunion-reference'

import { lookupCommand } from '../commands/lookup.js'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

type ReplyArg = { content?: string; embeds?: unknown[]; flags?: number }

/** Mock ChatInputCommandInteraction for `/su lookup`, recording the reply. */
function mockChatInput(entity: string) {
  const replies: ReplyArg[] = []
  const interaction = {
    options: {
      // lookup.execute reads getString('entity', true).
      getString: (name: string) => (name === 'entity' ? entity : null),
    },
    reply: (arg: ReplyArg) => {
      replies.push(arg)
      return Promise.resolve()
    },
  } as unknown as Parameters<typeof lookupCommand.execute>[0]
  return { interaction, replies }
}

/** Mock AutocompleteInteraction, recording the responded choices. */
function mockAutocomplete(focused: string) {
  const responses: { name: string; value: string }[][] = []
  const interaction = {
    options: { getFocused: () => focused },
    respond: (choices: { name: string; value: string }[]) => {
      responses.push(choices)
      return Promise.resolve()
    },
  } as unknown as Parameters<typeof lookupCommand.autocomplete>[0]
  return { interaction, responses }
}

function embedOf(reply: ReplyArg): { data: { title?: string; url?: string } } {
  return reply.embeds![0] as { data: { title?: string; url?: string } }
}

describe('lookupCommand.execute', () => {
  test('a `schemaName::slug` value resolves that exact entity and deep-links it', async () => {
    const { interaction, replies } = mockChatInput('systems::50-cal-machine-gun')
    await lookupCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    expect(replies[0]!.embeds).toHaveLength(1)
    const embed = embedOf(replies[0]!)
    expect(embed.data.title).toBe('.50 Cal Machine Gun')
    expect(embed.data.url).toBe('https://salvageunion.io/schema/systems/item/50-cal-machine-gun')
    expect(replies[0]!.flags).toBeUndefined()
  })

  test('free-typed text falls back to the top search hit', async () => {
    const { interaction, replies } = mockChatInput('cover')
    await lookupCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    expect(replies[0]!.embeds).toHaveLength(1)
    expect(embedOf(replies[0]!).data.title).toBeTruthy()
    // A real hit deep-links out; the not-found path would carry no embed.
    expect(replies[0]!.content).toBeUndefined()
  })

  test('a no-match query replies with an ephemeral "not found"', async () => {
    const { interaction, replies } = mockChatInput('zzzqqqxyzzy123')
    await lookupCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    expect(replies[0]!.embeds).toBeUndefined()
    expect(replies[0]!.content).toContain('No entity found')
    expect(replies[0]!.flags).toBe(MessageFlags.Ephemeral)
  })
})

describe('lookupCommand.autocomplete', () => {
  test('empty / whitespace-only input short-circuits to no choices', async () => {
    for (const focused of ['', '   ']) {
      const { interaction, responses } = mockAutocomplete(focused)
      await lookupCommand.autocomplete(interaction)
      expect(responses[0]).toEqual([])
    }
  })

  test('a real query yields `schemaName::slug` choice values, capped at 25', async () => {
    const { interaction, responses } = mockAutocomplete('machine gun')
    await lookupCommand.autocomplete(interaction)
    expect(responses).toHaveLength(1)
    const choices = responses[0]!
    expect(choices.length).toBeGreaterThan(0)
    expect(choices.length).toBeLessThanOrEqual(25)
    for (const c of choices) {
      // Names are capped to Discord's 100-char limit.
      expect(c.name.length).toBeLessThanOrEqual(100)
      // Values are the stable `schemaName::slug` deep-link key.
      expect(c.value).toMatch(/^[a-z-]+::[a-z0-9-]+$/)
    }
  })

  test('a gibberish query responds with an empty choice list', async () => {
    const { interaction, responses } = mockAutocomplete('zzzqqqxyzzy123')
    await lookupCommand.autocomplete(interaction)
    expect(responses[0]).toEqual([])
  })
})
