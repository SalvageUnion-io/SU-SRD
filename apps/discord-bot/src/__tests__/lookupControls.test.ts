/**
 * The lookup card's controls, through the real router: a tab or a page
 * REDRAWS the card it sits on (`update`, never a new message), and the
 * pattern picker answers privately with the pattern's Peek.
 */
import { describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord-api-types/v10'
import { buttonInteractionHandlerFor } from './helpers.js'

type Node = { content?: string; components?: Node[] }
type Json = { toJSON(): { components: Node[] } }

/** Every text in the container, a section's included. */
const textOf = (arg: { components?: readonly unknown[] } | undefined): string =>
  ((arg?.components?.[0] as Json | undefined)?.toJSON().components ?? [])
    .flatMap((node) => [node.content ?? '', ...(node.components ?? []).map((c) => c.content ?? '')])
    .join('\n')

describe('su:view', () => {
  test('a tab redraws the same message on that tab', async () => {
    const { handle, replies, updates } = buttonInteractionHandlerFor(
      'su:view:chassis::mule|patterns'
    )
    await handle()
    expect(replies).toHaveLength(0)
    expect(updates).toHaveLength(1)
    expect(updates[0]?.flags).toBe(MessageFlags.IsComponentsV2)
    expect(textOf(updates[0])).toContain('-# PATTERNS (6) · PAGE 1 OF 3')
  })

  test('a page redraws that page', async () => {
    const { handle, updates } = buttonInteractionHandlerFor('su:view:chassis::mule|patterns|2')
    await handle()
    expect(textOf(updates[0])).toContain('PAGE 3 OF 3')
  })

  test('an entry that is gone answers privately rather than redrawing', async () => {
    const { handle, replies, updates } = buttonInteractionHandlerFor(
      'su:view:chassis::nope|overview'
    )
    await handle()
    expect(updates).toHaveLength(0)
    expect(replies[0]?.flags).toBe(MessageFlags.Ephemeral)
  })
})

describe('su:peek', () => {
  test('the picked pattern answers privately, as its card', async () => {
    const { handle, replies, updates } = buttonInteractionHandlerFor('su:peek:chassis::mule', [
      'hauler',
    ])
    await handle()
    expect(updates).toHaveLength(0)
    expect(replies[0]?.flags).toBe(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
    expect(textOf(replies[0])).toContain('-# PATTERN · MULE')
  })

  test('no pick, or an unknown one, is a private error', async () => {
    const { handle, replies } = buttonInteractionHandlerFor('su:peek:chassis::mule', ['nope'])
    await handle()
    expect(replies[0]?.flags).toBe(MessageFlags.Ephemeral)
  })
})

describe('su:table', () => {
  test('See table answers privately with the rolled row marked', async () => {
    const { handle, replies } = buttonInteractionHandlerFor('su:table:Reactor Overload|14')
    await handle()
    expect(replies[0]?.flags).toBe(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  })
})
