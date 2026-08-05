/**
 * `/su check` handler tests — free-form dice rolling through @randsum/roller.
 *
 * The branches that matter: valid RANDSUM notation replies with a result embed
 * (echoed notation + dice + total) plus a "Roll again" button; invalid notation
 * replies with an ephemeral error instead of crashing (randsum is the source of
 * truth for validity — we just catch its throw).
 */
import { describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord.js'
import { buildCheckMessage, checkCommand } from '../commands/check.js'
import type { ReplyArg } from './fakeInteraction.js'
import { fakeExecute } from './fakeInteraction.js'

/** Pull the embed payload off a recorded reply. */
function embedData(reply: ReplyArg): {
  title?: string
  fields?: { name: string; value: string }[]
} {
  const embed = reply.embeds?.[0] as
    | { data: { title?: string; fields?: { name: string; value: string }[] } }
    | undefined
  if (!embed) throw new Error('expected an embed on the reply')
  return embed.data
}

/** Shared narrow-interaction fakes; see fakeInteraction.ts. */
function mockChatInput(dice: string | null) {
  const { interaction, replies } = fakeExecute({
    subcommand: 'check',
    strings: { dice },
    // Unbound: attribution is a no-op, so these assert the roll output itself.
    channelId: null,
  })
  return { interaction, replies }
}

describe('buildCheckMessage', () => {
  test('valid notation produces an embed echoing notation and total', () => {
    const message = buildCheckMessage('2d6+3')
    expect('error' in message).toBe(false)
    if ('error' in message) return
    expect(message.embeds).toHaveLength(1)
    const data = (
      message.embeds[0] as { data: { title?: string; fields?: { name: string; value: string }[] } }
    ).data
    expect(data.title).toContain('2d6+3')
    const total = data.fields?.find((f) => f.name === 'Total')
    expect(total).toBeDefined()
    // 2d6+3 ranges 5..15 — a real sum, always present.
    expect(Number(total?.value)).toBeGreaterThanOrEqual(5)
    expect(Number(total?.value)).toBeLessThanOrEqual(15)
    // A "Roll again" button rides along.
    expect(message.components).toHaveLength(1)
  })

  test('invalid notation returns an error, never throws', () => {
    const message = buildCheckMessage('not-dice-at-all')
    expect('error' in message).toBe(true)
    if (!('error' in message)) return
    expect(message.error).toContain('not-dice-at-all')
  })

  test('supports the full RANDSUM grammar (drop-lowest)', () => {
    const message = buildCheckMessage('4d6L')
    expect('error' in message).toBe(false)
  })

  test('stamps the Salvage Union author when given the bot avatar URL', () => {
    const message = buildCheckMessage('2d6+3', 'https://cdn.example/avatar.png')
    if ('error' in message) throw new Error('expected a roll, got an error')
    const json = message.embeds[0]?.toJSON() as {
      author?: { name?: string; icon_url?: string }
    }
    expect(json.author?.name).toBe('Salvage Union')
    expect(json.author?.icon_url).toBe('https://cdn.example/avatar.png')
  })

  test('omits the author when no avatar URL is available', () => {
    const message = buildCheckMessage('2d6+3')
    if ('error' in message) throw new Error('expected a roll, got an error')
    const json = message.embeds[0]?.toJSON() as { author?: unknown }
    expect(json.author).toBeUndefined()
  })
})

describe('checkCommand.execute', () => {
  test('valid notation replies with an embed and no ephemeral flag', async () => {
    const { interaction, replies } = mockChatInput('1d20+5')
    await checkCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.embeds).toHaveLength(1)
    expect(reply.flags).toBeUndefined()
    expect(embedData(reply).title).toContain('1d20+5')
  })

  test('invalid notation replies with an ephemeral error, not an embed', async () => {
    const { interaction, replies } = mockChatInput('garbage')
    await checkCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.embeds).toBeUndefined()
    expect(reply.content).toContain('garbage')
    expect(reply.flags).toBe(MessageFlags.Ephemeral)
  })
})
