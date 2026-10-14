import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from '../../index'
import { nameToSlug } from '../../nameToSlug'
import type { SURefMetaEntity } from '../../schemas/index'
import {
  COMPONENT_EMBED_MAX_BYTES,
  componentEmbedBytes,
  componentEmbedJson,
  discordEntryCard,
} from '../discordEntryCard'

/**
 * An entry's one Discord card (`/su lookup` and the SRD's Component Embed):
 * shed to the Component Embed's 3,000 bytes as served, a long table whole.
 */

function entry(schema: 'roll-tables' | 'chassis', slug: string): SURefMetaEntity {
  const found =
    schema === 'chassis'
      ? SalvageUnionReference.Chassis.getBySlug(slug)
      : SalvageUnionReference.RollTables.getBySlug(slug)
  if (!found) throw new Error(`no ${schema} ${slug}`)
  return found as SURefMetaEntity
}

describe('discordEntryCard', () => {
  test('a short entry is whole: nothing shed, no link out', () => {
    const json = componentEmbedJson(discordEntryCard(entry('chassis', 'mule')))
    expect(json).not.toContain('on salvageunion.io](')
    expect(componentEmbedBytes(json)).toBeLessThanOrEqual(COMPONENT_EMBED_MAX_BYTES)
  })

  test('a table too long for Discord is a link to the whole table, not its top rows', () => {
    const json = componentEmbedJson(discordEntryCard(entry('roll-tables', 'anomalous-zone')))
    expect(componentEmbedBytes(json)).toBeLessThanOrEqual(COMPONENT_EMBED_MAX_BYTES)
    expect(json).toContain('See the whole table on salvageunion.io')
    expect(json).not.toContain('ROLL THE DIE')
  })

  test('a pattern is its own card; its host only links it', () => {
    const mule = entry('chassis', 'mule')
    const [pattern] = (mule as { patterns?: { name: string }[] }).patterns ?? []
    if (!pattern) throw new Error('the Mule has no pattern')
    const host = componentEmbedJson(discordEntryCard(mule))
    expect(host).toContain(
      `[${pattern.name}](https://salvageunion.io/chassis/mule/pattern/${nameToSlug(pattern.name)})`
    )
    const own = componentEmbedJson(discordEntryCard(mule, pattern as never))
    expect(own).toContain(pattern.name)
  })

  test('with an SRD origin, every SRD link is on it, and the budget is measured there', () => {
    const preview = 'https://pr-1-su-srd.example.workers.dev'
    for (const found of [entry('chassis', 'mule'), entry('roll-tables', 'anomalous-zone')]) {
      const json = componentEmbedJson(discordEntryCard(found, undefined, { srdOrigin: preview }))
      expect(json).toContain(`](${preview}/`)
      expect(json).not.toContain('](https://salvageunion.io')
      expect(componentEmbedBytes(json)).toBeLessThanOrEqual(COMPONENT_EMBED_MAX_BYTES)
    }
  })

  test('an origin with trailing slashes links without doubling them', () => {
    const preview = 'https://pr-1-su-srd.example.workers.dev'
    const mule = entry('chassis', 'mule')
    expect(
      componentEmbedJson(discordEntryCard(mule, undefined, { srdOrigin: `${preview}///` }))
    ).toBe(componentEmbedJson(discordEntryCard(mule, undefined, { srdOrigin: preview })))
  })

  test("production's origin, given, is the card without one", () => {
    const mule = entry('chassis', 'mule')
    expect(
      componentEmbedJson(
        discordEntryCard(mule, undefined, { srdOrigin: 'https://salvageunion.io' })
      )
    ).toBe(componentEmbedJson(discordEntryCard(mule)))
  })
})

describe('componentEmbedBytes', () => {
  test('counts each `<` as its six-byte script escape, as the SRD serves it', () => {
    expect(componentEmbedBytes('ab')).toBe(2)
    expect(componentEmbedBytes('a<b')).toBe(8)
    expect(componentEmbedBytes('é')).toBe(2)
  })
})
