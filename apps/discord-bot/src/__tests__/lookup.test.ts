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

import { buildTableLookupMessage, lookupCommand } from '../commands/lookup.js'

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
    // execute reads client.user for embed branding; no avatar in tests.
    client: { user: null },
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
  return reply.embeds?.[0] as { data: { title?: string; url?: string } }
}

describe('lookupCommand.execute', () => {
  test('a `schemaName::slug` value resolves that exact entity and deep-links it', async () => {
    const { interaction, replies } = mockChatInput('systems::50-cal-machine-gun')
    await lookupCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.embeds).toHaveLength(1)
    const embed = embedOf(reply)
    expect(embed.data.title).toBe('.50 Cal Machine Gun')
    expect(embed.data.url).toBe('https://salvageunion.io/schema/systems/item/50-cal-machine-gun')
    expect(reply.flags).toBeUndefined()
  })

  test('free-typed text falls back to the top search hit', async () => {
    const { interaction, replies } = mockChatInput('cover')
    await lookupCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.embeds).toHaveLength(1)
    expect(embedOf(reply).data.title).toBeTruthy()
    // A real hit deep-links out; the not-found path would carry no embed.
    expect(reply.content).toBeUndefined()
  })

  test('a no-match query replies with an ephemeral "not found"', async () => {
    const { interaction, replies } = mockChatInput('zzzqqqxyzzy123')
    await lookupCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.embeds).toBeUndefined()
    expect(reply.content).toContain('No entity found')
    expect(reply.flags).toBe(MessageFlags.Ephemeral)
  })
})

describe('buildTableLookupMessage — the "See table" button target', () => {
  test('resolves a roll-table by name into its full lookup embed', () => {
    const message = buildTableLookupMessage('Core Mechanic')
    expect('error' in message).toBe(false)
    if ('error' in message) return
    const embed = message.embeds[0]?.toJSON() as { title?: string; description?: string }
    expect(embed.title).toBe('Core Mechanic')
    // Full rows are inlined (backtick roll keys), not just a link-out.
    expect(embed.description).toContain('`20`')
    // A roll-table lookup offers a one-click "Roll on this table" button.
    expect(message.components).toHaveLength(1)
  })

  test('returns an error for an unknown table name', () => {
    const message = buildTableLookupMessage('No Such Table 9000')
    expect('error' in message).toBe(true)
    if ('error' in message) expect(message.error).toContain('Could not find table')
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
    const choices = responses[0]
    if (!choices) throw new Error('expected a response')
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
