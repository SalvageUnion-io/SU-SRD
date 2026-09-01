/**
 * `/su roll` handler tests — execute + autocomplete against mock interactions.
 *
 * su.test.ts already pins the builder shape; these exercise the handler
 * logic: the known-table happy path, the unknown-table ephemeral error, and
 * the autocomplete substring filter + Discord's 25-choice cap.
 */
import { describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord.js'
import { rollCommand } from '../commands/roll.js'
import { fakeAutocomplete, fakeExecute } from './fakeInteraction.js'

/** Shared narrow-interaction fakes; see fakeInteraction.ts. */
function mockChatInput(table: string | null) {
  const { interaction, replies } = fakeExecute({
    subcommand: 'roll',
    strings: { table },
    // Unbound: roll attribution is a no-op, so these assert the roll output
    // itself, unchanged from before ITUN existed.
    channelId: null,
  })
  return { interaction, replies }
}

function mockAutocomplete(focused: string) {
  const { interaction, responses } = fakeAutocomplete({ subcommand: 'roll', focused })
  return { interaction, responses }
}

describe('rollCommand.execute', () => {
  test('a named table replies with a V2 container, publicly', async () => {
    const { interaction, replies } = mockChatInput('Core Mechanic')
    await rollCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    // V2 is all-in per message: components and the flag, never embeds.
    expect(reply.components).toHaveLength(1)
    expect(reply.embeds).toBeUndefined()
    // Ephemeral is absent; the flag carries IsComponentsV2 alone.
    expect(reply.flags).toBe(MessageFlags.IsComponentsV2)
  })

  test('defaults to Core Mechanic when no table is given', async () => {
    const { interaction, replies } = mockChatInput(null)
    await rollCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.components).toHaveLength(1)
    expect(reply.content).toBeUndefined()
  })

  test('table lookup is case-insensitive', async () => {
    const { interaction, replies } = mockChatInput('core mechanic')
    await rollCommand.execute(interaction)
    expect(replies[0]?.components).toHaveLength(1)
  })

  test('an unknown table replies with an ephemeral container, not a dead-end string', async () => {
    const { interaction, replies } = mockChatInput('Not A Real Table')
    await rollCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.content).toBeUndefined()
    expect(reply.components).toHaveLength(1)
    // Ephemeral AND V2 — a typo is the asker's problem, not the channel's.
    expect(reply.flags).toBe(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  })

  test('a near-miss offers tapped recovery rather than telling you to try again', async () => {
    const { interaction, replies } = mockChatInput('criticl damage')
    await rollCommand.execute(interaction)
    const container = replies[0]?.components?.[0] as { toJSON(): { components: unknown[] } }
    const row = container.toJSON().components.find((c) => (c as { type: number }).type === 1) as
      | { components: { label: string }[] }
      | undefined
    expect(row).toBeDefined()
    // The search index that already backs autocomplete finds the real table.
    expect(row?.components.map((b) => b.label)).toContain('Critical Damage')
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
