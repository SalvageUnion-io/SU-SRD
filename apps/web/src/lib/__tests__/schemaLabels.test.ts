/**
 * One label per schema. What this pins: search rows never print `schemaTitle`
 * with a 'Salvage Union ' prefix stripped — a prefix no catalog title carries —
 * or entity rows read 'crawler-bays' under a category row reading 'Crawler
 * Bays'.
 */
import { describe, expect, it } from 'bun:test'
import { getSchemaCatalog } from 'salvageunion-reference'
import { schemaPluralLabel } from '../schemaLabels'

describe('schemaPluralLabel', () => {
  it('returns the authored plural, not the kebab-case schema id', () => {
    expect(schemaPluralLabel('crawler-bays')).toBe('Crawler Bays')
    expect(schemaPluralLabel('roll-tables')).toBe('Roll Tables')
  })

  it('keeps the irregular plurals the package authored', () => {
    expect(schemaPluralLabel('npcs')).toBe('NPCs')
    expect(schemaPluralLabel('bio-titans')).toBe('Bio-Titans')
    expect(schemaPluralLabel('chassis')).toBe('Chassis')
    expect(schemaPluralLabel('equipment')).toBe('Equipment')
  })

  it('labels meta schemas too — a label is not a claim that a page exists', () => {
    expect(schemaPluralLabel('actions')).toBe('Actions')
  })

  it('labels every schema in the catalog without falling back to the id', () => {
    for (const schema of getSchemaCatalog().schemas) {
      expect(schemaPluralLabel(schema.id)).toBe(schema.displayNamePlural)
      expect(schemaPluralLabel(schema.id)).not.toBe(schema.id)
    }
  })

  it('falls back to the id for an unknown schema', () => {
    expect(schemaPluralLabel('not-a-schema')).toBe('not-a-schema')
  })
})
