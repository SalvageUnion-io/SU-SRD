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

  test('a mech pattern says what differs, its loadout: no slot or Scrap column (r8 E11)', () => {
    const mule = SalvageUnionReference.Chassis.getByName('Mule')
    if (!mule || !('patterns' in mule)) throw new Error('mule fixture missing')
    const { container } = render(
      <EntitySurfaceProvider value={{ hrefFor: srdHrefFor }}>
        <PatternLedger chassis={mule} patterns={mule.patterns as RefObjectAnyPattern[]} />
      </EntitySurfaceProvider>
    )
    const heads = [...container.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(heads.join(' ')).not.toMatch(/Sys|Mod|Scrap/)
    const cells = [...(container.querySelector('tbody tr')?.querySelectorAll('td') ?? [])]
    // The loadout alone, beside the name.
    expect(cells).toHaveLength(1)
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
    expect(noted.length).toBeLessThan(container.querySelectorAll('tbody tr').length)
    expect(container.querySelector('tfoot')?.textContent ?? '').not.toContain('as printed')
  })
})
