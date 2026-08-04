/**
 * A chassis PATTERN has no entity of its own — it is a nested object on the
 * chassis, so its card's `data` IS the chassis. These tests pin the three
 * things that makes true of the UI:
 *
 * 1. A pattern row in a chassis's Patterns list is a real link to that
 *    pattern's own page, resolved through `PatternHrefProvider`.
 * 2. With no provider (an app whose patterns have no pages) the row stays inert
 *    rather than linking nowhere.
 * 3. The full pattern view reads chassis prose → chassis ability → pattern prose
 *    → systems → modules, so the pattern is framed by the chassis it belongs to.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference, nameToSlug, visiblePatterns } from 'salvageunion-reference'
import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import { EntityHrefProvider, PatternHrefProvider } from '../../entityHrefContext'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

/** The Mule — a chassis carrying patterns, a chassis ability and chassis prose. */
const mule = () => {
  const found = SalvageUnionReference.Chassis.all().find((c) => c.name === 'Mule')
  if (!found) throw new Error('Mule fixture missing')
  return found
}

/** Stands in for srd's route builder. */
const testPatternHref = (chassis: SURefEntity, pattern: SURefObjectPattern) =>
  `/chassis/${'name' in chassis ? nameToSlug(String(chassis.name)) : ''}/pattern/${nameToSlug(pattern.name)}`

describe('chassis pattern rows', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('each row links to its pattern page', () => {
    const chassis = mule()
    render(
      <PatternHrefProvider value={testPatternHref}>
        <ReferenceEntityCard data={chassis} />
      </PatternHrefProvider>
    )

    const links = screen.getAllByRole('link', { name: /— Mule pattern$/ })
    expect(links.length).toBe(visiblePatterns(chassis.patterns ?? []).length)
    expect(links.length).toBeGreaterThan(0)

    const hauler = screen.getByRole('link', { name: 'Hauler — Mule pattern' })
    expect(hauler.getAttribute('href')).toBe('/chassis/mule/pattern/hauler')
  })

  test('a hidden pattern gets no row', () => {
    const chassis = mule()
    const hidden = (chassis.patterns ?? []).filter((p) => p.hidden)
    expect(hidden.length).toBeGreaterThan(0)

    render(
      <PatternHrefProvider value={testPatternHref}>
        <ReferenceEntityCard data={chassis} />
      </PatternHrefProvider>
    )

    for (const pattern of hidden) {
      expect(screen.queryByRole('link', { name: `${pattern.name} — Mule pattern` })).toBeNull()
    }
  })

  test('without a href builder the row is not a link', () => {
    render(<ReferenceEntityCard data={mule()} />)
    expect(screen.queryAllByRole('link', { name: /— Mule pattern$/ }).length).toBe(0)
    // The row itself still renders — it just isn't navigable.
    expect(screen.queryAllByText(/Hauler/).length).toBeGreaterThan(0)
  })
})

describe('full pattern view reading order', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('reads chassis prose → chassis ability → pattern prose → systems → modules', () => {
    const chassis = mule()
    const pattern = chassis.patterns?.find((p) => p.name === 'Hauler')
    if (!pattern) throw new Error('Hauler pattern fixture missing')

    const { container } = render(
      <ReferenceEntityCard data={chassis} pattern={pattern} size="large" />
    )
    const text = container.textContent ?? ''

    const chassisProse = text.indexOf("The 'M-63' Mule was developed")
    const chassisAbility = text.indexOf('Integrated Cargo Bay')
    const patternProse = text.indexOf('This Mule, favoured by wastelanders')
    const systems = text.indexOf('Transport Hold')
    const modules = text.indexOf('Reactor Flare')

    for (const index of [chassisProse, chassisAbility, patternProse, systems, modules]) {
      expect(index).toBeGreaterThan(-1)
    }
    expect(chassisProse).toBeLessThan(chassisAbility)
    expect(chassisAbility).toBeLessThan(patternProse)
    expect(patternProse).toBeLessThan(systems)
    expect(systems).toBeLessThan(modules)
  })

  test('a system installed six times renders six badges, not one', () => {
    // The end-to-end guard for the multiplicity fix in `resolvePatternGroups`.
    // Atlas's Thunder Storm prints as ".50 Cal Machine Gun x6" in the book; the
    // card used to de-duplicate the loadout by entity id, so the whole pattern
    // rendered a single machine gun and read as a far lighter build than it is.
    //
    // The loadout is now a row of SHORTFORM badges rather than full cards, and
    // multiplicity still REPEATS: six copies are six badges, not one badge
    // reading "×6". A count collapses the shape of the build out of the one row
    // whose job is showing it.
    const chassis = SalvageUnionReference.Chassis.all().find((c) => c.name === 'Atlas')
    if (!chassis) throw new Error('Atlas fixture missing')
    const pattern = chassis.patterns?.find((p) => p.name === 'Thunder Storm')
    if (!pattern) throw new Error('Thunder Storm pattern fixture missing')
    // Guard the fixture: the count is what drives the expansion.
    expect(pattern.systems?.find((s) => s.name === '.50 Cal Machine Gun')?.count).toBe(6)

    render(<ReferenceEntityCard data={chassis} pattern={pattern} size="large" />)

    // One name node per rendered badge.
    expect(screen.getAllByText('.50 Cal Machine Gun')).toHaveLength(6)
    // No collapsed count anywhere — the copies are the count.
    expect(screen.queryByText(/×6/)).toBeNull()
    // The uncounted systems stay single — the fix must not multiply everything.
    expect(screen.getAllByText('Shotgun Pit')).toHaveLength(1)
    expect(screen.getAllByText('Armour Plating')).toHaveLength(1)
  })
})

/**
 * THE LOADOUT IS A ROW OF LINKED BADGES. A pattern's systems and modules are
 * ordinary catalogue entities whose full text lives on their own pages, so the
 * pattern view cites them at the card's shortform rung and links out, rather
 * than reprinting every rule inline — Thunder Storm used to expand to six
 * full-length, identical .50 Cal Machine Gun cards.
 */
describe('pattern loadout badges', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  /** Stands in for srd's entity route builder. */
  const testEntityHref = (entity: SURefEntity) =>
    `/schema/${'schemaName' in entity ? String(entity.schemaName) : ''}/item/${
      'name' in entity ? nameToSlug(String(entity.name)) : ''
    }`

  const thunderStorm = () => {
    const chassis = SalvageUnionReference.Chassis.all().find((c) => c.name === 'Atlas')
    if (!chassis) throw new Error('Atlas fixture missing')
    const pattern = chassis.patterns?.find((p) => p.name === 'Thunder Storm')
    if (!pattern) throw new Error('Thunder Storm pattern fixture missing')
    return { chassis, pattern }
  }

  test('every loadout entry links to its own page', () => {
    const { chassis, pattern } = thunderStorm()
    render(
      <EntityHrefProvider value={testEntityHref}>
        <ReferenceEntityCard data={chassis} pattern={pattern} size="large" />
      </EntityHrefProvider>
    )

    // All six machine-gun copies are links, each to the system's one page.
    const guns = screen.getAllByRole('link', { name: /\.50 Cal Machine Gun/ })
    expect(guns).toHaveLength(6)
    for (const gun of guns) {
      expect(gun.getAttribute('href')).toBe('/schema/systems/item/50-cal-machine-gun')
    }
    // Modules link out through the same builder.
    expect(screen.getByRole('link', { name: /Comms Module/ }).getAttribute('href')).toBe(
      '/schema/modules/item/comms-module'
    )
  })

  test('the loadout does not reprint the entities` rules inline', () => {
    const { chassis, pattern } = thunderStorm()
    const { container } = render(
      <ReferenceEntityCard data={chassis} pattern={pattern} size="large" />
    )
    // The machine gun's own description belongs on its page, not six times over
    // in a pattern's loadout.
    expect(container.textContent).not.toContain('This simple ballistic weapon')
  })

  test('without a href builder the badges are not links', () => {
    const { chassis, pattern } = thunderStorm()
    render(<ReferenceEntityCard data={chassis} pattern={pattern} size="large" />)
    expect(screen.queryAllByRole('link', { name: /\.50 Cal Machine Gun/ })).toHaveLength(0)
    // The badges themselves still render — they just aren't navigable.
    expect(screen.getAllByText('.50 Cal Machine Gun')).toHaveLength(6)
  })

  test('each loadout group is an announced list', () => {
    // The loadout is a countable set of installed parts, so it is a real `ul`:
    // a screen reader says "list, 6 items" instead of reading a run of
    // anonymous links. The links carry their own name (the entity's), NOT the
    // badge's scraped text — that would read ".50 Cal Machine Gun TL 1".
    const { chassis, pattern } = thunderStorm()
    render(
      <EntityHrefProvider value={testEntityHref}>
        <ReferenceEntityCard data={chassis} pattern={pattern} size="large" />
      </EntityHrefProvider>
    )
    expect(screen.getByRole('list', { name: 'Systems installed' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Modules installed' })).toBeTruthy()
    // Exact accessible name, tail excluded.
    expect(screen.getAllByRole('link', { name: '.50 Cal Machine Gun' })).toHaveLength(6)
  })
})

/**
 * A PATTERN CARD IS NEVER `flat` — it takes the aside lead, which drops the
 * float. `wrapFlat` DISCARDS the key it is handed when `flat` is false, so
 * every call site has to set the key on the card itself too. The drone row was
 * the one that didn't, which made every multi-drone pattern on an artwork
 * chassis (all three Little Sestra patterns, Big Brother's DronTek) render
 * keyless list children the moment patterns moved below the fold.
 */
describe('pattern drone rows keep their keys', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('no keyless-children warning on a drone-fielding pattern', () => {
    const warnings: string[] = []
    const realError = console.error
    console.error = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    }
    try {
      for (const name of ['Little Sestra', 'Big Brother']) {
        const chassis = SalvageUnionReference.Chassis.all().find((c) => c.name === name)
        if (!chassis) throw new Error(`${name} fixture missing`)
        for (const pattern of chassis.patterns ?? []) {
          render(<ReferenceEntityCard data={chassis} pattern={pattern} size="large" />)
          cleanup()
        }
      }
    } finally {
      console.error = realError
    }
    expect(warnings.filter((w) => w.includes('unique "key"'))).toHaveLength(0)
  })
})

/**
 * FOOTER PROVENANCE. A pattern carries its OWN source/booklet/page — often a
 * DIFFERENT book than the chassis it hangs off (the Mule ships from the Workshop
 * Manual, but its Acid Spitter pattern is from "We Were Here First!"). Because a
 * pattern card's `data` IS the chassis, the identity footer must read the
 * pattern's provenance, never the chassis's. Booklet + page fall back as one
 * unit with the source, so a pattern's source is never paired with the chassis's
 * page.
 */
describe('pattern footer provenance', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  const patternOf = (name: string): SURefObjectPattern => {
    const found = mule().patterns?.find((p) => p.name === name)
    if (!found) throw new Error(`${name} pattern fixture missing`)
    return found
  }

  test("the footer shows the pattern's own source + page, not the chassis's", () => {
    const chassis = mule()
    const acidSpitter = patternOf('Acid Spitter')
    // Guard the fixture: the pattern must genuinely diverge from its chassis.
    expect(acidSpitter.source).toBe('We Were Here First!')
    expect(acidSpitter.source).not.toBe(chassis.source)
    expect(acidSpitter.page).not.toBe(chassis.page)

    render(<ReferenceEntityCard data={chassis} pattern={acidSpitter} />)

    // The footer joins source · page into one line.
    expect(screen.getByText(`We Were Here First! · p.${acidSpitter.page}`)).toBeTruthy()
    // The chassis's own provenance must NOT leak into the pattern footer.
    expect(screen.queryByText(`${chassis.source} · p.${chassis.page}`)).toBeNull()
  })

  test('a booklet rides with the pattern source', () => {
    const survivor = patternOf('Survivor')
    // Survivor is from the Starter Set, booklet "PC" — booklet must pair with
    // the pattern's source, not be borrowed from the chassis.
    expect(survivor.source).toBe('Salvage Union Starter Set')
    expect(survivor.booklet).toBe('PC')

    render(<ReferenceEntityCard data={mule()} pattern={survivor} />)
    expect(screen.getByText(`Salvage Union Starter Set (PC) · p.${survivor.page}`)).toBeTruthy()
  })
})

/**
 * The "Legal Starting Pattern" seam stamp. It rides the seam RIGHT of the
 * `[Chassis | …]` marker specifically so it survives the LISTING extent — the
 * pattern rows under a chassis are header-only, and that list is where a reader
 * choosing a starting mech actually looks. Driven purely by the stored
 * `legalStarting` data tag; never computed from tech level or salvage value.
 */
describe('legal starting pattern seam stamp', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  const patternOf = (name: string): SURefObjectPattern => {
    const found = mule().patterns?.find((p) => p.name === name)
    if (!found) throw new Error(`${name} pattern fixture missing`)
    return found
  }

  test('the full pattern card stamps a tagged pattern', () => {
    render(<ReferenceEntityCard data={mule()} pattern={patternOf('Hauler')} />)
    expect(screen.getAllByText('Legal Starting Pattern').length).toBe(1)
  })

  test('an untagged pattern carries no stamp', () => {
    render(<ReferenceEntityCard data={mule()} pattern={patternOf('Crusher')} />)
    expect(screen.queryByText('Legal Starting Pattern')).toBeNull()
  })

  test('the chassis pattern LISTING stamps exactly its tagged patterns', () => {
    const chassis = mule()
    render(<ReferenceEntityCard data={chassis} />)
    const tagged = (chassis.patterns ?? []).filter((p) => p.legalStarting === true)
    expect(tagged.length).toBeGreaterThan(0)
    expect(screen.getAllByText('Legal Starting Pattern').length).toBe(tagged.length)
  })
})
