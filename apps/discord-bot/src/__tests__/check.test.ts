/**
 * `/su check` handler tests — free-form dice rolling through @randsum/roller.
 *
 * The branches that matter: valid RANDSUM notation replies with a Components V2
 * container (the total as the headline, the dice as code spans) plus a "Roll
 * again" button; invalid notation replies with an ephemeral error instead of
 * crashing (randsum is the source of truth for validity — we just catch its
 * throw).
 */
import { describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord.js'
import { buildCheckMessage, checkCommand } from '../commands/check.js'
import type { ContainerData } from '../container.js'
import { fakeExecute } from './fakeInteraction.js'

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

/** Every rendered text block, joined — what a reader actually sees. */
function containerText(data: ContainerData): string {
  return data.blocks
    .map((b) => (b.kind === 'text' ? b.content : b.kind === 'section' ? b.text.join('\n') : ''))
    .join('\n')
}

describe('buildCheckMessage', () => {
  test('the total is the headline, not the third field', () => {
    const message = buildCheckMessage('2d6+3')
    expect('error' in message).toBe(false)
    if ('error' in message) return
    const text = containerText(message.data)
    // 2d6+3 ranges 5..15 — whatever it rolled, it is the `##` heading rather
    // than being buried in an inline field.
    const total = text.match(/## (\d+)/)
    expect(total).not.toBeNull()
    expect(Number(total?.[1])).toBeGreaterThanOrEqual(5)
    expect(Number(total?.[1])).toBeLessThanOrEqual(15)
    // The notation is still echoed — "did it roll what I typed" is a real
    // need, just not a headline-sized one.
    expect(text).toContain('2D6+3')
    // A "Roll again" button rides along.
    expect(message.data.blocks.some((b) => b.kind === 'buttons')).toBe(true)
  })

  test('individual dice render as inline code spans', () => {
    const message = buildCheckMessage('2d6+3')
    if ('error' in message) throw new Error('expected a roll, got an error')
    // Each die in its own monospace box, so the run wraps naturally at any
    // width — what 10d6 needs and a comma-joined field value never gave.
    expect(containerText(message.data)).toMatch(/`\d+`/)
  })

  test('invalid notation returns a container, never throws', () => {
    const message = buildCheckMessage('not-dice-at-all')
    expect('error' in message).toBe(false)
    if ('error' in message) return
    // Randsum is the source of truth for validity; we render its complaint.
    expect(containerText(message.data)).toContain('not-dice-at-all')
    expect(message.ephemeral).toBe(true)
  })

  test('supports the full RANDSUM grammar (drop-lowest)', () => {
    const message = buildCheckMessage('4d6L')
    expect('error' in message).toBe(false)
  })

  test('names the roller when one is given', () => {
    const message = buildCheckMessage('2d6+3', 'Vex Marrow')
    if ('error' in message) throw new Error('expected a roll, got an error')
    expect(containerText(message.data)).toContain('rolled by Vex Marrow')
  })

  test('omits the roller line cleanly when none is given', () => {
    const message = buildCheckMessage('2d6+3')
    if ('error' in message) throw new Error('expected a roll, got an error')
    expect(containerText(message.data)).not.toContain('rolled by')
  })

  test('a bare 1d20 is the Core Mechanic, so it earns the tier treatment', () => {
    const message = buildCheckMessage('1d20')
    if ('error' in message) throw new Error('expected a roll, got an error')
    const text = containerText(message.data)
    expect(text).toMatch(/NAILED IT|SUCCESS|TOUGH CHOICE|FAILURE|CASCADE FAILURE/)
  })

  test('the band summary is body copy, not a second line of footer', () => {
    // It used to render as `-# Core Mechanic · <summary>` above the
    // attribution. Two lines of small print under every check was the busiest
    // part of the surface; the summary is real rules text and reads as body.
    const message = buildCheckMessage('1d20')
    if ('error' in message) throw new Error('expected a roll, got an error')
    const small = containerText(message.data)
      .split('\n')
      .filter((line) => line.startsWith('-# '))
    expect(small).toHaveLength(2) // context line + attribution
    expect(small.at(-1)).toBe('-# Salvage Union Reference · Powered by Randsum.dev')
  })

  test('a modified d20 is NOT tiered — Salvage Union reads the die raw', () => {
    // Tiering a modified total would be a rules error dressed as a feature.
    const message = buildCheckMessage('1d20+5')
    if ('error' in message) throw new Error('expected a roll, got an error')
    expect(containerText(message.data)).not.toMatch(/NAILED IT|TOUGH CHOICE|CASCADE FAILURE/)
  })
})

describe('checkCommand.execute', () => {
  test('valid notation replies with a public V2 container', async () => {
    const { interaction, replies } = mockChatInput('1d20+5')
    await checkCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.components).toHaveLength(1)
    expect(reply.embeds).toBeUndefined()
    expect(reply.flags).toBe(MessageFlags.IsComponentsV2)
  })

  test('invalid notation replies with an ephemeral container carrying examples', async () => {
    const { interaction, replies } = mockChatInput('garbage')
    await checkCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.content).toBeUndefined()
    expect(reply.flags).toBe(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  })
})
