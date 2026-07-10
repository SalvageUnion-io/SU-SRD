/**
 * `/su roll` handler tests — execute + autocomplete against mock interactions.
 *
 * su.test.ts already pins the builder shape; these exercise the handler
 * logic: the known-table happy path, the unknown-table ephemeral error, and
 * the autocomplete substring filter + Discord's 25-choice cap.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord.js'
import { SalvageUnionReference } from 'salvageunion-reference'

import { rollCommand } from '../commands/roll.js'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

type ReplyArg = { content?: string; embeds?: unknown[]; flags?: number }

/** Mock ChatInputCommandInteraction for `/su roll`, recording the reply. */
function mockChatInput(table: string | null) {
  const replies: ReplyArg[] = []
  const interaction = {
    options: {
      getString: (name: string) => (name === 'table' ? table : null),
    },
    // execute reads client.user for embed branding; no avatar in tests.
    client: { user: null },
    reply: (arg: ReplyArg) => {
      replies.push(arg)
      return Promise.resolve()
    },
  } as unknown as Parameters<typeof rollCommand.execute>[0]
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
  } as unknown as Parameters<typeof rollCommand.autocomplete>[0]
  return { interaction, responses }
}

describe('rollCommand.execute', () => {
  test('a named table replies with an embed titled after the table', async () => {
    const { interaction, replies } = mockChatInput('Core Mechanic')
    await rollCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.embeds).toBeDefined()
    expect(reply.embeds).toHaveLength(1)
    const embed = reply.embeds?.[0] as { data: { title?: string } }
    // The roll embed titles itself with an outcome tier, so just assert an
    // embed (not an error string) came back and no ephemeral flag was set.
    expect(embed.data.title).toBeTruthy()
    expect(reply.flags).toBeUndefined()
  })

  test('defaults to Core Mechanic when no table is given', async () => {
    const { interaction, replies } = mockChatInput(null)
    await rollCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.embeds).toHaveLength(1)
    expect(reply.content).toBeUndefined()
  })

  test('table lookup is case-insensitive', async () => {
    const { interaction, replies } = mockChatInput('core mechanic')
    await rollCommand.execute(interaction)
    expect(replies[0]?.embeds).toHaveLength(1)
  })

  test('an unknown table replies with an ephemeral error, not an embed', async () => {
    const { interaction, replies } = mockChatInput('Not A Real Table')
    await rollCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.embeds).toBeUndefined()
    expect(reply.content).toContain('Could not find table')
    expect(reply.flags).toBe(MessageFlags.Ephemeral)
  })
})

describe('rollCommand.autocomplete', () => {
  test('filters table names by the focused substring (case-insensitive)', async () => {
    const { interaction, responses } = mockAutocomplete('core')
    await rollCommand.autocomplete(interaction)
    expect(responses).toHaveLength(1)
    const choices = responses[0]
    if (!choices) throw new Error('expected a response')
    expect(choices.length).toBeGreaterThan(0)
    // Every choice must actually contain the query, and name === value.
    for (const c of choices) {
      expect(c.name.toLowerCase()).toContain('core')
      expect(c.value).toBe(c.name)
    }
    expect(choices.some((c) => c.name === 'Core Mechanic')).toBe(true)
  })

  test('an empty focused value returns every table, capped at 25', async () => {
    const { interaction, responses } = mockAutocomplete('')
    await rollCommand.autocomplete(interaction)
    expect(responses[0]?.length).toBeLessThanOrEqual(25)
    expect(responses[0]?.length).toBeGreaterThan(0)
  })

  test('a no-match query responds with an empty choice list', async () => {
    const { interaction, responses } = mockAutocomplete('zzzqqqxyzzy123')
    await rollCommand.autocomplete(interaction)
    expect(responses[0]).toEqual([])
  })
})
