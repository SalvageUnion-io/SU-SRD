/**
 * REPRINT PROVENANCE — the identity footer's one citation line: every
 * printing, the book first, `//` between, no "Also in".
 *
 * 383 records in the dataset carry `additionalSources`: researched provenance
 * for which OTHER book (and page) an entity was reprinted in — the Starter Set
 * condensations, the expansion re-listings. It was declared in Zod and populated
 * in the data but read by nothing, so none of it reached a reader.
 *
 * These tests pin what it now does, and — just as importantly — where it stays
 * silent: it follows the primary source on the same line, on every card that
 * has a foot.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { RefObjectPattern } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { formatProvenance, resolveAdditionalSources } from '../provenance'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const equipmentNamed = (name: string) => {
  const found = SalvageUnionReference.Equipment.getByName(name)
  if (!found) throw new Error(`${name} equipment fixture missing`)
  return found
}

const droneNamed = (name: string) => {
  const found = SalvageUnionReference.Drones.getByName(name)
  if (!found) throw new Error(`${name} drone fixture missing`)
  return found
}

const chassisNamed = (name: string) => {
  const found = SalvageUnionReference.Chassis.getByName(name)
  if (!found) throw new Error(`${name} chassis fixture missing`)
  return found
}

const patternOf = (chassis: string, pattern: string): RefObjectPattern => {
  const found = chassisNamed(chassis).patterns?.find((p) => p.name === pattern)
  if (!found) throw new Error(`${chassis}/${pattern} pattern fixture missing`)
  return found
}

describe('the one citation line', () => {
  test('a reprinted entity names the book, booklet and page it was reprinted in', () => {
    // First Aid Kit: Workshop Manual p.80, condensed into the Starter Set's
    // Pilots Handbook booklet at p.38.
    const kit = equipmentNamed('First Aid Kit')
    expect(kit.additionalSources).toEqual([
      { source: 'Salvage Union Starter Set', booklet: 'PH', page: 38 },
    ])

    render(<ReferenceEntityCard data={kit} />)

    // The PRIMARY source first, then the reprint, on ONE line, `//` between.
    expect(
      screen.getByText(`Workshop Manual · p.${kit.page} // Salvage Union Starter Set (PH) · p.38`)
    ).toBeTruthy()
    expect(screen.queryByText('Also in')).toBeNull()
  })

  test('two reprints both print, and a single-volume book shows no booklet', () => {
    // Survey Drone is the dataset's only two-reprint record: one booklet-bearing
    // (Starter Set Asset Pack) and one single-volume (Reclamation of the Wastes).
    const drone = droneNamed('Survey Drone')
    expect(drone.additionalSources).toEqual([
      { source: 'Salvage Union Starter Set', booklet: 'AP', page: 2 },
      { source: 'Reclamation of the Wastes', page: 103 },
    ])

    render(<ReferenceEntityCard data={drone} />)

    expect(
      screen.getByText(
        `Workshop Manual · p.${drone.page} // Salvage Union Starter Set (AP) · p.2 // Reclamation of the Wastes · p.103`
      )
    ).toBeTruthy()
  })

  test('an entity with no reprints gets no line at all', () => {
    // Most records have none — the line must be absent, not empty.
    const sled = equipmentNamed('Hover Sled')
    expect(sled.additionalSources).toBeUndefined()

    render(<ReferenceEntityCard data={sled} />)

    // The footer is otherwise intact: the primary source still prints.
    expect(screen.getByText(`Workshop Manual · p.${sled.page}`)).toBeTruthy()
    expect(screen.queryByText('Also in')).toBeNull()
  })
})

describe('reprint provenance across sizes', () => {
  test('a compact card (and so a Peek) prints every source on the one line too', () => {
    const kit = equipmentNamed('First Aid Kit')
    const { container } = render(<ReferenceEntityCard data={kit} size="compact" />)
    const text = container.textContent ?? ''
    expect(text).toContain(
      `Workshop Manual · p.${kit.page} // Salvage Union Starter Set (PH) · p.38`
    )
    expect(text).not.toContain('Also in')
  })
})

describe('a pattern reprints on its own provenance', () => {
  test("the pattern's own reprint prints on a pattern card", () => {
    const operator = patternOf('Spectrum', 'Operator')
    expect(operator.additionalSources).toEqual([{ source: "Thatcher's Mech Base", page: 1 }])

    render(<ReferenceEntityCard data={chassisNamed('Spectrum')} pattern={operator} />)

    expect(screen.getByText(/ \/\/ Thatcher's Mech Base · p\.1$/)).toBeTruthy()
  })

  test("a chassis's reprint never leaks onto a pattern that has none", () => {
    // The Mule IS reprinted (Starter Set Parts Catalogue p.12); its Hauler
    // pattern is not. Provenance falls back as ONE unit, so a pattern carrying
    // its own source must not borrow the chassis's reprints.
    const mule = chassisNamed('Mule')
    const hauler = patternOf('Mule', 'Hauler')
    expect(mule.additionalSources).toEqual([
      { source: 'Salvage Union Starter Set', booklet: 'PC', page: 12 },
    ])
    expect(hauler.source).toBeTruthy()
    expect(hauler.additionalSources).toBeUndefined()

    const { container } = render(<ReferenceEntityCard data={mule} pattern={hauler} />)
    expect(container.textContent ?? '').not.toContain(' // ')
  })

  test('the chassis card itself does print its reprint', () => {
    // Proves the previous test is a real probe rather than a card that never
    // renders reprints at all.
    render(<ReferenceEntityCard data={chassisNamed('Mule')} />)
    expect(screen.getByText(/ \/\/ Salvage Union Starter Set \(PC\) · p\.12$/)).toBeTruthy()
  })
})

describe('provenance formatting', () => {
  test('a booklet only ever prints alongside its source', () => {
    expect(formatProvenance('Salvage Union Starter Set', 'PH', 38)).toBe(
      'Salvage Union Starter Set (PH) · p.38'
    )
    expect(formatProvenance('Reclamation of the Wastes', undefined, 103)).toBe(
      'Reclamation of the Wastes · p.103'
    )
    // A booklet code names nothing without the book it indexes into.
    expect(formatProvenance(undefined, 'PH', 38)).toBe('p.38')
    // The core book prints by its one name, whatever the data calls it.
    expect(formatProvenance('Salvage Union Workshop Manual', undefined, undefined)).toBe(
      'Workshop Manual'
    )
    expect(formatProvenance(undefined, undefined, undefined)).toBeUndefined()
  })

  test('a half-formed record is dropped rather than rendered', () => {
    expect(resolveAdditionalSources(undefined)).toEqual([])
    expect(resolveAdditionalSources('Salvage Union Starter Set')).toEqual([])
    expect(
      resolveAdditionalSources([
        { source: 'Salvage Union Starter Set', page: 38 },
        { source: 'No Page' },
        { page: 12 },
        null,
      ])
    ).toEqual([{ source: 'Salvage Union Starter Set', page: 38 }])
  })
})
