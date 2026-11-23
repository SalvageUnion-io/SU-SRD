import { describe, expect, test } from 'bun:test'
import { entityTraitLabels, entityTraitTerms } from '../listingTraits'

const model = {
  traits: [
    { name: 'Uses', param: 'Destroy', schemaName: 'traits' },
    { name: 'Hot', param: '3', schemaName: 'traits' },
    { name: 'Guided', schemaName: 'traits' },
    { name: 'Burn', param: 'X', schemaName: 'traits' },
  ],
} as unknown as Parameters<typeof entityTraitLabels>[0]

describe("a listing's traits, each with its value (RR7-17)", () => {
  test('a word after a colon, a number after a space', () => {
    expect(entityTraitLabels(model)).toEqual(['Uses: Destroy', 'Hot 3', 'Guided', 'Burn X'])
    expect(entityTraitTerms(model).map((term) => term.label)).toEqual([
      'Uses: Destroy',
      'Hot 3',
      'Guided',
      'Burn X',
    ])
  })
})
