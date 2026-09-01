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
import { describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord.js'
import { buildTableLookupMessage, lookupCommand } from '../commands/lookup.js'
import type { ReplyArg } from './fakeInteraction.js'
import { fakeAutocomplete, fakeExecute } from './fakeInteraction.js'

/** Shared narrow-interaction fakes; see fakeInteraction.ts. */
function mockChatInput(entity: string) {
  const { interaction, replies } = fakeExecute({ subcommand: 'lookup', strings: { entity } })
  return { interaction, replies }
}

function mockAutocomplete(focused: string) {
  const { interaction, responses } = fakeAutocomplete({ subcommand: 'lookup', focused })
  return { interaction, responses }
}

/** Every rendered text block of a V2 reply, joined — what a reader sees. */
function containerTextOf(reply: ReplyArg): string {
  const container = reply.components?.[0] as { toJSON(): { components: unknown[] } } | undefined
  if (!container) throw new Error('expected a container on the reply')
  return container
    .toJSON()
    .components.flatMap((c) => {
      const node = c as { content?: string; components?: { content?: string }[] }
      if (node.content !== undefined) return [node.content]
      // a section's text lives one level down, beside its thumbnail accessory
      return (node.components ?? []).map((t) => t.content ?? '')
    })
    .join('\n')
}

describe('lookupCommand.execute', () => {
  test('a `schemaName::slug` value resolves that exact entity and deep-links it', async () => {
    const { interaction, replies } = mockChatInput('systems::50-cal-machine-gun')
    await lookupCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.components).toHaveLength(1)
    // The deep link survives the move to a container as a masked link in the
    // heading — a container has no title slot to carry a url.
    expect(containerTextOf(reply)).toContain(
      '## [.50 Cal Machine Gun](https://salvageunion.io/schema/systems/item/50-cal-machine-gun)'
    )
    expect(reply.flags).toBe(MessageFlags.IsComponentsV2)
  })

  test('free-typed text falls back to the top search hit', async () => {
    const { interaction, replies } = mockChatInput('cover')
    await lookupCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.components).toHaveLength(1)
    expect(containerTextOf(reply)).toContain('## [')
    // A real hit deep-links out; the not-found path carries content instead.
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
  test('resolves a roll-table by name into its full lookup container', () => {
    const message = buildTableLookupMessage('Core Mechanic')
    expect('error' in message).toBe(false)
    if ('error' in message) return
    const text = message.data.blocks
      .map((b) => (b.kind === 'text' ? b.content : b.kind === 'section' ? b.text.join('\n') : ''))
      .join('\n')
    // The title survives the move as a masked link — a container has no title
    // slot, and masked links do render inside a TextDisplay.
    expect(text).toContain('## [Core Mechanic](https://salvageunion.io/')
    // Full rows are still inlined (backtick roll keys), not just a link-out.
    expect(text).toContain('`20`')
    // A roll-table lookup offers a one-click "Roll on this table" button.
    expect(message.data.blocks.some((b) => b.kind === 'buttons')).toBe(true)
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
