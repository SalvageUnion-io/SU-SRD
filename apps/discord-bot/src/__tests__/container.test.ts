import { describe, expect, test } from 'bun:test'
import { ButtonStyle, MessageFlags } from 'discord-api-types/v10'
import type { ContainerData } from '../container'
import {
  containerComponentCount,
  containerTextLength,
  enforceContainerLimits,
  entityCard,
  toContainer,
  V2_LIMIT,
} from '../container'

const base: ContainerData = {
  accent: 0x4b86a0,
  blocks: [
    { kind: 'text', content: '-# CORE MECHANIC' },
    { kind: 'text', content: '## 20 NAILED IT' },
    { kind: 'separator' },
    { kind: 'text', content: '-# d20 20 · Core Book p.232' },
    {
      kind: 'buttons',
      buttons: [
        { kind: 'action', customId: 'su:roll:Core Mechanic', label: 'Roll again' },
        { kind: 'link', url: 'https://salvageunion.io/roll-tables', label: 'See table' },
      ],
    },
  ],
}

describe('toContainer', () => {
  test('carries the accent colour V2 would otherwise cost', () => {
    // The tier colour rides on the container's accent.
    const json = toContainer(base).toJSON()
    expect(json.type).toBe(17)
    expect(json.accent_color).toBe(0x4b86a0)
  })

  test('emits blocks in authored order with the right component types', () => {
    const json = toContainer(base).toJSON()
    expect(json.components.map((c) => c.type)).toEqual([10, 10, 14, 10, 1])
  })

  test('a link button carries a url and no custom_id', () => {
    const json = toContainer(base).toJSON()
    const row = json.components.at(-1)
    if (row?.type !== 1) throw new Error('expected an action row last')
    const [action, link] = row.components
    expect(action).toMatchObject({ custom_id: 'su:roll:Core Mechanic' })
    expect(link).toMatchObject({ style: ButtonStyle.Link, url: expect.stringContaining('http') })
    expect(link).not.toHaveProperty('custom_id')
  })

  test('a section carries its thumbnail as an accessory', () => {
    const json = toContainer({
      accent: 0,
      blocks: [
        {
          kind: 'section',
          text: ['**Aegis**'],
          thumbnail: { url: 'https://assets.salvageunion.io/chassis/aegis.webp', description: 'A' },
        },
      ],
    }).toJSON()
    const section = json.components[0]
    if (section?.type !== 9) throw new Error('expected a section')
    expect(section.accessory.type).toBe(11)
  })

  test('the built payload serialises to what Discord receives', () => {
    // adapter.ts hands builders over as they are; JSON.stringify calls their
    // toJSON() on the way to the wire.
    const payload = {
      flags: MessageFlags.IsComponentsV2,
      components: [toContainer(base)],
    }
    expect(payload.flags).toBe(32768)
    expect(JSON.stringify(payload)).toContain('"accent_color":4949664')
  })
})

describe('limit enforcement', () => {
  test('counts the container itself, plus every leaf', () => {
    // 1 container + 3 text + 1 separator + 1 row + 2 buttons
    expect(containerComponentCount(base)).toBe(8)
  })

  test('sheds blocks from the end until the text budget fits', () => {
    const fat: ContainerData = {
      accent: 0,
      blocks: [
        { kind: 'text', content: 'a'.repeat(2000) },
        { kind: 'text', content: 'b'.repeat(2000) },
        { kind: 'text', content: 'c'.repeat(2000) },
      ],
    }
    const out = enforceContainerLimits(fat)
    expect(containerTextLength(out)).toBeLessThanOrEqual(V2_LIMIT.totalText)
    // The first-authored block is the headline; it survives.
    expect(out.blocks[0]?.kind === 'text' && out.blocks[0].content.startsWith('a')).toBe(true)
  })

  test('never sheds the buttons — a roll result without "Roll again" is not the thing people use', () => {
    const fat: ContainerData = {
      accent: 0,
      blocks: [
        { kind: 'text', content: 'a'.repeat(3000) },
        { kind: 'text', content: 'b'.repeat(3000) },
        {
          kind: 'buttons',
          buttons: [{ kind: 'action', customId: 'su:roll:X', label: 'Roll again' }],
        },
      ],
    }
    const out = enforceContainerLimits(fat)
    expect(out.blocks.some((b) => b.kind === 'buttons')).toBe(true)
    expect(containerTextLength(out)).toBeLessThanOrEqual(V2_LIMIT.totalText)
  })

  test('a menu is a control: never shed, and it costs its row and itself', () => {
    const menu = {
      kind: 'select' as const,
      customId: 'su:open:chassis::kelpie::sifter',
      placeholder: 'Open a linked entry',
      options: [{ label: 'Floodlights', value: 'systems::floodlights' }],
    }
    expect(containerComponentCount({ accent: 0, blocks: [menu] })).toBe(3)
    const out = enforceContainerLimits({
      accent: 0,
      blocks: [{ kind: 'text', content: 'a'.repeat(5000) }, menu],
    })
    expect(out.blocks).toContainEqual(menu)
  })

  test('a menu renders as one string select in its own action row', () => {
    const json = toContainer({
      accent: 0,
      blocks: [
        {
          kind: 'select',
          customId: 'su:open:x',
          placeholder: 'Open a linked entry',
          options: Array.from({ length: 30 }, (_, i) => ({ label: `E${i}`, value: `v${i}` })),
        },
      ],
    }).toJSON()
    const row = json.components[0] as {
      type: number
      components: { type: number; options: unknown[] }[]
    }
    expect(row.type).toBe(1)
    expect(row.components[0]?.type).toBe(3)
    // Discord's cap is 25 options.
    expect(row.components[0]?.options).toHaveLength(V2_LIMIT.selectOptions)
  })

  test('a section takes at most three text blocks, per the builder predicate', () => {
    const out = enforceContainerLimits({
      accent: 0,
      blocks: [{ kind: 'section', text: ['a', 'b', 'c', 'd', 'e'] }],
    })
    expect(out.blocks[0]?.kind === 'section' && out.blocks[0].text).toHaveLength(3)
  })

  test('toContainer enforces without being asked', () => {
    // One choke point: a caller cannot forget the guard.
    expect(() =>
      toContainer({ accent: 0, blocks: [{ kind: 'text', content: 'x'.repeat(9000) }] })
    ).not.toThrow()
  })
})

describe('entityCard', () => {
  const card = {
    title: 'Rustjaw',
    url: 'https://salvageunion.io/build/games/g1',
    accent: 0x7a978a,
    description: '*Mule*',
    fields: [
      { name: 'SP', value: '8/12', inline: true },
      { name: 'Heat', value: '3/6', inline: true },
      { name: 'Systems — 1', value: 'Armour Plating' },
    ],
    footer: 'The Cantina',
  }

  test('renders heading, prose, fields, then a rule and the footer', () => {
    expect(entityCard(card)).toEqual({
      accent: 0x7a978a,
      blocks: [
        { kind: 'text', content: '## [Rustjaw](https://salvageunion.io/build/games/g1)' },
        { kind: 'text', content: '*Mule*' },
        // Consecutive inline fields run together as one rail.
        { kind: 'text', content: '**SP** 8/12\n**Heat** 3/6' },
        // A full-width field is a slab: bold heading, body beneath.
        { kind: 'text', content: '**Systems — 1**\nArmour Plating' },
        { kind: 'separator' },
        { kind: 'text', content: '-# The Cantina' },
      ],
    })
  })

  test('a bare title has no link', () => {
    const { url: _url, ...unlinked } = card
    expect(entityCard(unlinked).blocks[0]).toEqual({ kind: 'text', content: '## Rustjaw' })
  })

  test('artwork hangs beside the heading and prose in one section', () => {
    const art = 'https://assets.salvageunion.io/chassis/mule.webp'
    const blocks = entityCard({ ...card, thumbnail: art }).blocks
    expect(blocks[0]).toEqual({
      kind: 'section',
      text: ['## [Rustjaw](https://salvageunion.io/build/games/g1)', '*Mule*'],
      thumbnail: { url: art, description: 'Rustjaw' },
    })
    expect(blocks[1]).toEqual({ kind: 'text', content: '**SP** 8/12\n**Heat** 3/6' })
  })
})
