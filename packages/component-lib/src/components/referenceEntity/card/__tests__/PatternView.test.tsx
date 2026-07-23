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
import { beforeAll, describe, expect, test, afterEach } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'
import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import { PatternHrefProvider } from '../../entityHrefContext'
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

afterEach(cleanup)

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
    expect(links.length).toBe(chassis.patterns?.length ?? 0)
    expect(links.length).toBeGreaterThan(0)

    const hauler = screen.getByRole('link', { name: 'Hauler — Mule pattern' })
    expect(hauler.getAttribute('href')).toBe('/chassis/mule/pattern/hauler')
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
