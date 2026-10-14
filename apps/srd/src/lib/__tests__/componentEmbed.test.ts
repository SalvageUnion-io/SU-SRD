import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { COMPONENT_EMBED_MAX_BYTES, componentEmbedFor } from '../componentEmbed'
import { escapeJsonForScript } from '../escapeJsonForScript'
import { getItemStaticPaths, getPatternStaticPaths } from '../staticPaths'

type Embed = {
  component: { type: number; accent_color: number; components: { type: number }[] }
}

const parse = (json: string): Embed => JSON.parse(json) as Embed
/** As served: BaseLayout script-escapes the JSON. */
const bytes = (json: string): number => new TextEncoder().encode(escapeJsonForScript(json)).length

describe('componentEmbedFor', () => {
  const mule = SalvageUnionReference.Chassis.getByName('Mule')
  if (!mule) throw new Error('no Mule')

  it('is one Container in the mech tone, the card the bot sends', () => {
    const embed = parse(componentEmbedFor(mule))
    expect(embed.component.type).toBe(17)
    expect(embed.component.accent_color).toBe(0x7a978a)
    const json = JSON.stringify(embed)
    expect(json).toContain('## [Mule](https://salvageunion.io/chassis/mule)')
    expect(json).toContain('**SP** 12')
  })

  it('holds every entity and pattern page under Discord’s 3,000 bytes, with no nested container', () => {
    const pages = [
      ...getItemStaticPaths().map(({ props }) => componentEmbedFor(props.item)),
      ...getPatternStaticPaths().map(({ props }) => componentEmbedFor(props.host, props.pattern)),
    ]
    expect(pages.length).toBeGreaterThan(500)
    for (const json of pages) {
      expect(bytes(json)).toBeLessThanOrEqual(COMPONENT_EMBED_MAX_BYTES)
      const { component } = parse(json)
      expect(component.components.every((child) => child.type !== 17)).toBe(true)
    }
  })
})
