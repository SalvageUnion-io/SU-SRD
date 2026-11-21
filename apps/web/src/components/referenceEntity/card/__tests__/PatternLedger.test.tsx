/**
 * A chassis's patterns Ledger (ledger.md L4, EDL E26): each pattern's name
 * links its Page, and each part its loadout line names links its entry, whose
 * Page lists the pattern back. It draws no foot (L6).
 */
import { describe, expect, test } from 'bun:test'
import { render, within } from '@testing-library/react'
import type { RefObjectAnyPattern } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { srdHrefFor } from '../../../../lib/entityHref'
import { EntitySurfaceProvider } from '../../../index'
import { PatternLedger } from '../PatternLedger'

describe('PatternLedger', () => {
  test("a loadout's parts link their entries, and the Ledger has no foot", () => {
    const mule = SalvageUnionReference.Chassis.getByName('Mule')
    if (!mule || !('patterns' in mule)) throw new Error('mule fixture missing')
    const patterns = mule.patterns as RefObjectAnyPattern[]
    const { container } = render(
      <EntitySurfaceProvider value={{ hrefFor: srdHrefFor }}>
        <PatternLedger chassis={mule} patterns={patterns} />
      </EntitySurfaceProvider>
    )
    const hauler = container.querySelector('tbody tr')
    if (!hauler) throw new Error('no rows')
    const hatch = within(hauler as HTMLElement).getByRole('link', { name: 'Escape Hatch' })
    expect(hatch.getAttribute('href')).toBe('/systems/escape-hatch/')
    expect(container.querySelector('[data-foot-band]')).toBeNull()
  })
})
