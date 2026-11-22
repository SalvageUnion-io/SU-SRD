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

  test('a mech pattern says what it uses and costs: slots of the chassis’s, and Scrap (r2 G4)', () => {
    const mule = SalvageUnionReference.Chassis.getByName('Mule')
    if (!mule || !('patterns' in mule)) throw new Error('mule fixture missing')
    const { container } = render(
      <EntitySurfaceProvider value={{ hrefFor: srdHrefFor }}>
        <PatternLedger chassis={mule} patterns={mule.patterns as RefObjectAnyPattern[]} />
      </EntitySurfaceProvider>
    )
    const heads = [...container.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(heads.join(' ')).toMatch(/Sys.*Mod.*Scrap/)
    const cells = [...(container.querySelector('tbody tr')?.querySelectorAll('td') ?? [])].map(
      (td) => td.textContent ?? ''
    )
    // The loadout line, then System Slots and Module Slots of the Mule's, then its Scrap.
    expect(cells[1]).toMatch(/^\d+\/\d+$/)
    expect(cells[2]).toMatch(/^\d+\/\d+$/)
    expect(Number(cells[3])).toBeGreaterThan(0)
    // A phone keeps the figures; the packed loadout line gives way to the name.
    const phone = [...container.querySelectorAll('thead th[data-phone]')].map(
      (th) => th.textContent
    )
    expect(phone.join(' ')).toMatch(/Sys.*Mod.*Scrap/)
  })

  test('a book pattern over its chassis’s slots says it is as printed (r3 C5)', () => {
    const atlas = SalvageUnionReference.Chassis.getByName('Atlas')
    if (!atlas || !('patterns' in atlas)) throw new Error('atlas fixture missing')
    const { container } = render(
      <EntitySurfaceProvider value={{ hrefFor: srdHrefFor }}>
        <PatternLedger chassis={atlas} patterns={atlas.patterns as RefObjectAnyPattern[]} />
      </EntitySurfaceProvider>
    )
    expect(container.textContent).toContain('as printed in the book')
  })
})
