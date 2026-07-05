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

type ReplyArg = { content?: string; embeds?: unknown[]; components?: unknown[]; flags?: number }

/** Mock ChatInputCommandInteraction for `/su check`, recording the reply. */
function mockChatInput(dice: string | null) {
  const replies: ReplyArg[] = []
  const interaction = {
    options: {
      getString: (name: string) => (name === 'dice' ? dice : null),
    },
    reply: (arg: ReplyArg) => {
      replies.push(arg)
      return Promise.resolve()
    },
  } as unknown as Parameters<typeof checkCommand.execute>[0]
  return { interaction, replies }
}

function embedData(reply: ReplyArg): {
  title?: string
  fields?: { name: string; value: string }[]
} {
  return (
    reply.embeds![0] as { data: { title?: string; fields?: { name: string; value: string }[] } }
  ).data
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
    expect(Number(total!.value)).toBeGreaterThanOrEqual(5)
    expect(Number(total!.value)).toBeLessThanOrEqual(15)
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
})

describe('checkCommand.execute', () => {
  test('valid notation replies with an embed and no ephemeral flag', async () => {
    const { interaction, replies } = mockChatInput('1d20+5')
    await checkCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    expect(replies[0]!.embeds).toHaveLength(1)
    expect(replies[0]!.flags).toBeUndefined()
    expect(embedData(replies[0]!).title).toContain('1d20+5')
  })

  test('invalid notation replies with an ephemeral error, not an embed', async () => {
    const { interaction, replies } = mockChatInput('garbage')
    await checkCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    expect(replies[0]!.embeds).toBeUndefined()
    expect(replies[0]!.content).toContain('garbage')
    expect(replies[0]!.flags).toBe(MessageFlags.Ephemeral)
  })
})
