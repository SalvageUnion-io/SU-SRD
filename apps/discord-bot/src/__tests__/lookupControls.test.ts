/**
 * The lookup card's controls, through the real router: a long card's Read
 * button answers privately with one action.
 */
import { describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord-api-types/v10'
import { buttonInteractionHandlerFor } from './helpers'

type Node = { content?: string; components?: Node[] }
type Json = { toJSON(): { components: Node[] } }

/** Every text in the container, a section's included. */
const textOf = (arg: { components?: readonly unknown[] } | undefined): string =>
  ((arg?.components?.[0] as Json | undefined)?.toJSON().components ?? [])
    .flatMap((node) => [node.content ?? '', ...(node.components ?? []).map((c) => c.content ?? '')])
    .join('\n')

describe('su:table', () => {
  test('See table answers privately with the rolled row marked', async () => {
    const { handle, replies } = buttonInteractionHandlerFor('su:table:Reactor Overload|14')
    await handle()
    expect(replies[0]?.flags).toBe(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  })
})

describe('su:read', () => {
  test('Read answers privately with the one action, whole', async () => {
    const { handle, replies } = buttonInteractionHandlerFor(
      'su:read:bio-titans::cortex-bio-titan|proboscis'
    )
    await handle()
    expect(replies[0]?.flags).toBe(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
    expect(textOf(replies[0])).toContain('### Proboscis')
  })

  test('an action that is gone is a private error', async () => {
    const { handle, replies } = buttonInteractionHandlerFor(
      'su:read:bio-titans::cortex-bio-titan|nope'
    )
    await handle()
    expect(replies[0]?.flags).toBe(MessageFlags.Ephemeral)
  })
})
