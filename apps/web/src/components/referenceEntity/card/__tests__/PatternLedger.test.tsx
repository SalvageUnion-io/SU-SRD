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
    // The Loadout column's link, and the same in the phone's fold under the name (r6 E5).
    const hatches = within(hauler as HTMLElement).getAllByRole('link', { name: 'Escape Hatch' })
    for (const hatch of hatches) expect(hatch.getAttribute('href')).toBe('/systems/escape-hatch/')
    expect(hauler.querySelector('details.su-pattern-fold summary')?.textContent).toBe('Loadout')
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
    // By Tech Level, never one sum across them (r6 E4).
    expect(cells[3]).toMatch(/^TL\d+ \d+( · TL\S+ \d+)*$/)
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
    // On the rows it describes, and on no other (r4 E16).
    const noted = [...container.querySelectorAll('tbody tr')].filter((row) =>
      row.textContent?.includes('Over its limit as printed in the book')
    )
    expect(noted.length).toBeGreaterThan(0)
    for (const row of noted) {
      const over = [...row.querySelectorAll('td')].some((cell) => {
        const [used, max] = (cell.textContent?.match(/^(\d+)\/(\d+)$/) ?? []).slice(1).map(Number)
        return used !== undefined && max !== undefined && used > max
      })
      expect(over).toBe(true)
    }
    expect(container.querySelector('tfoot')?.textContent ?? '').not.toContain('as printed')
  })
})
