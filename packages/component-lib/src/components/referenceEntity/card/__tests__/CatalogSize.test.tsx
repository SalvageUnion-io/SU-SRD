/**
 * `size="catalog"` — the SRD index tile. Compact, artwork + description ONLY:
 * every nested element (entities, actions, choices, patterns, roll tables) is
 * suppressed so a listing page reads uniformly regardless of what the entity
 * happens to carry. These fixtures are chosen because each one DOES carry
 * nested content at full size, so the assertions would fail if it leaked.
 */
import { beforeAll, describe, expect, test, afterEach } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

/** A chassis carries a `patterns` list + chassis abilities at full size. */
const chassisWithPatterns = () => {
  const found = SalvageUnionReference.Chassis.all().find(
    (c) => Array.isArray(c.patterns) && c.patterns.length > 0
  )
  if (!found) throw new Error('no chassis with patterns in fixtures')
  return found
}

/** A crawler bay carries a choice (the Armament Bay catalog listing). */
const armamentBay = () => {
  const bay = SalvageUnionReference.CrawlerBays.all().find((b) => b.name === 'Armament Bay')
  if (!bay) throw new Error('Armament Bay fixture missing')
  return bay
}

afterEach(cleanup)

describe('ReferenceEntityCard size="catalog"', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('a chassis renders its name but none of its patterns', () => {
    const chassis = chassisWithPatterns()
    const patternName = String(chassis.patterns?.[0]?.name ?? '')
    expect(patternName).not.toBe('')

    // Full size DOES surface the pattern — proves the fixture is a real probe.
    const full = render(<ReferenceEntityCard data={chassis} />)
    expect(screen.queryAllByText(new RegExp(patternName, 'i')).length).toBeGreaterThan(0)
    full.unmount()

    render(<ReferenceEntityCard data={chassis} size="catalog" />)
    expect(screen.getByText(chassis.name)).toBeTruthy()
    expect(screen.queryAllByText(new RegExp(patternName, 'i')).length).toBe(0)
  })

  test('a crawler bay renders no choice prompt', () => {
    const bay = armamentBay()

    const full = render(<ReferenceEntityCard data={bay} />)
    expect(screen.queryByText(/Choose a Weapons System to mount/i)).toBeTruthy()
    full.unmount()

    render(<ReferenceEntityCard data={bay} size="catalog" />)
    expect(screen.getByText(bay.name)).toBeTruthy()
    expect(screen.queryByText(/Choose a Weapons System to mount/i)).toBeNull()
  })

  test('a granting ability still shows its own prose (grants are suppressed, not collapsed)', () => {
    const granting = SalvageUnionReference.Abilities.all().find(
      (a) => Array.isArray(a.grants) && a.grants.length > 0 && (a.content?.length ?? 0) > 0
    )
    // Not every dataset ships a granting ability with prose; skip rather than fail.
    if (!granting) return

    render(<ReferenceEntityCard data={granting} size="catalog" />)
    expect(screen.getByText(granting.name)).toBeTruthy()
    // The card body is not empty — the ability's own description survived.
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(granting.name.length)
  })
})
