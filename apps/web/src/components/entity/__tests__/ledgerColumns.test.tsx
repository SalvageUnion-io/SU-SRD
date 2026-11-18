/**
 * A Ledger's columns keep the stat order (ledger.md L5, ruleset §2.6):
 * `ledgerOrderFaults` judges a head strip's stamps, and every SRD index's
 * List (`IndexLedger`) is held to it on the real dataset. The same judge
 * reads every Ledger a page draws (`e2e/_ledger.ts`, rule `order`).
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { RefEntity, RefEnumSchemaName } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { IndexLedger } from '../../islands/IndexLedger'
import { ledgerOrderFaults, ledgerRank } from '../ledgerOrder'

describe('ledgerOrderFaults', () => {
  test('the stat order passes, whatever a list drops', () => {
    expect(
      ledgerOrderFaults(['TL', 'Slots', 'SV', 'SP', 'EP', 'Sys', 'Mods', 'Heat', 'Cargo'])
    ).toEqual([])
    expect(ledgerOrderFaults(['Slots', 'Action', 'RNG', 'DMG', 'Traits', 'Cost'])).toEqual([])
    expect(ledgerOrderFaults(['Lvl', 'Action', 'AP'])).toEqual([])
  })

  test('words that place the entity carry no rank', () => {
    expect(ledgerRank('Tree')).toBeUndefined()
    expect(ledgerOrderFaults(['Tree', 'Slots', 'Made by', 'RNG', 'Loadout'])).toEqual([])
  })

  test('a moved column fails, named with the stat it stands after', () => {
    expect(ledgerOrderFaults(['Slots', 'Cost', 'RNG', 'DMG'])).toEqual([
      'RNG after Cost',
      'DMG after Cost',
    ])
    expect(ledgerOrderFaults(['SP', 'EP', 'SV'])).toEqual(['SV after EP'])
  })
})

const INDEXES: RefEnumSchemaName[] = [
  'chassis',
  'systems',
  'modules',
  'equipment',
  'abilities',
  'classes',
  'crawlers',
  'crawler-bays',
  'creatures',
  'npcs',
  'squads',
  'bio-titans',
  'drones',
  'vehicles',
]

describe("every SRD index's List keeps the stat order", () => {
  for (const schema of INDEXES) {
    test(schema, () => {
      const items = SalvageUnionReference.findAllIn(schema, () => true) as RefEntity[]
      expect(items.length).toBeGreaterThan(0)
      const { container } = render(<IndexLedger schemaId={schema} noun={schema} items={items} />)
      const stamps = Array.from(container.querySelectorAll('thead th'))
        .slice(1)
        .map((th) => (th.textContent ?? '').trim())
      expect(stamps.length).toBeGreaterThan(0)
      expect(ledgerOrderFaults(stamps)).toEqual([])
    })
  }
})
