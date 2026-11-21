/**
 * A Ledger's columns keep the stat order (ledger.md L5, ruleset §2.6): every
 * SRD index's List (`IndexLedger`) is held to `ledgerOrderFaults` on the real
 * dataset. The same judge reads every Ledger a page draws (`e2e/_ledger.ts`,
 * rule `order`).
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { ledgerOrderFaults } from 'gates/lib/ledgerOrder'
import type { RefEntity, RefEnumSchemaName } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { IndexLedger } from '../../islands/IndexLedger'

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
