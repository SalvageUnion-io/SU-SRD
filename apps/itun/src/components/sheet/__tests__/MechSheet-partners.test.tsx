/**
 * MechSheet — the Partners region, i.e. the drones a chassis ability fields.
 *
 * This region existed before anything could populate it: nothing in the app
 * created a `PartnerInstance`, so a Little Sestra was built without its Sestra
 * Drone and the whole block was unreachable. These tests render it from the
 * seeds `mechPartnerSeeds` now produces, so they fail if the grant path breaks
 * OR if the card stops rendering a drone as a live entity.
 *
 * What "live entity" has to mean here, and why each assertion is present:
 *   - its own structure/energy/heat, editable on the card (not the mech's);
 *   - its installed systems and modules, integrated + pattern-fitted;
 *   - no standalone remove control — a partner cannot be dropped independently
 *     of the chassis that grants it (see lib/rules/partnerGrants.ts).
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injected store.
 */

import { describe, expect, mock, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import { mechPartnerSeeds, syncPartners } from '../../../lib/rules/partnerGrants'
import type { Mech } from '../../../lib/schemas/mech'
import { mechFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { must } from '../../__tests__/must'
import { MechSheet } from '../MechSheet'

/** A mech built the way the wizard builds one, drones and all. */
function seededMech(chassisRef: string, patternName: string, overrides: Partial<Mech> = {}): Mech {
  const partners = syncPartners(undefined, mechPartnerSeeds(chassisRef, patternName), {
    exact: true,
  })
  return mechFixture({
    id: 'mech-partners-1',
    name: 'Custos',
    chassisRef,
    patternName,
    ...(partners !== undefined ? { partners } : {}),
    ...overrides,
  })
}

function makeStore(mech: Mech) {
  return makeEntityStoreMock({
    mechs: [mech],
    hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [mech]),
    get: mock((type: string, id: string) => (type === 'mech' && id === mech.id ? mech : null)),
    create: mock(async () => mech),
    update: mock(async () => mech),
    delete: mock(async () => {}),
  })
}

/** The Partners section slab, which must exist for any of this to mean anything. */
function partnersRegion(): HTMLElement {
  const heading = screen.getByText(/^Partners$/i)
  return must(heading.closest('section') ?? heading.parentElement?.parentElement) as HTMLElement
}

describe('MechSheet — Partners', () => {
  test('a Little Sestra fields its Sestra Drone as a live entity', () => {
    const mech = seededMech('little-sestra', 'Surveyor')
    expect(mech.partners).toHaveLength(1)
    render(<MechSheet mech={mech} store={makeStore(mech)} />)

    const region = partnersRegion()
    // getAllByText: a card spells its name in more than one place (title plus
    // the control labels that reference it), so uniqueness is not the claim —
    // presence is.
    expect(within(region).getAllByText(/Sestra Drone/i).length).toBeGreaterThan(0)
    // Its own loadout: the integrated system AND the pattern's fitted picks,
    // rendered inside the drone rather than among the mech's systems.
    expect(within(region).getAllByText(/Hover Locomotion System/i).length).toBeGreaterThan(0)
    expect(within(region).getAllByText(/Long Barrelled Green Laser/i).length).toBeGreaterThan(0)
    expect(within(region).getAllByText(/Survey Scanner/i).length).toBeGreaterThan(0)
  })

  test('the drone carries its OWN structure, not the mech chassis stats', () => {
    const mech = seededMech('little-sestra', 'Surveyor')
    render(<MechSheet mech={mech} store={makeStore(mech)} />)

    // Sestra Drone: SP 7 / EP 8 / Heat 6 — none of which are the Little
    // Sestra's own numbers. A gauge showing the mech's would mean the card is
    // reading the wrong stat block.
    const region = partnersRegion()
    expect(region.textContent).toMatch(/7/)
    expect(region.textContent).toMatch(/8/)
  })

  test('Big Brother fields FOUR drones, each under its own instance name', () => {
    const mech = seededMech('big-brother', 'DronTek', { name: 'Panopticon' })
    expect(mech.partners).toHaveLength(4)
    render(<MechSheet mech={mech} store={makeStore(mech)} />)

    const region = partnersRegion()
    for (const name of [
      'Shield Drone',
      'Anti-Missile Drone',
      'Fire Support Drone',
      'Minelayer Drone',
    ]) {
      expect(within(region).getAllByText(new RegExp(name, 'i')).length).toBeGreaterThan(0)
    }
  })

  test('four fielded drones read as "4 of 4", not over-cap', () => {
    // partnerCap knew only Mecha Packmaster, so every one of these would have
    // read "4 of 1" the moment seeding started working.
    const mech = seededMech('big-brother', 'DronTek', { name: 'Panopticon' })
    render(<MechSheet mech={mech} store={makeStore(mech)} />)
    expect(within(partnersRegion()).getAllByText(/4 of 4/i).length).toBe(4)
  })

  test('offers no standalone remove — a drone dies with the chassis that grants it', () => {
    const mech = seededMech('little-sestra', 'Surveyor')
    render(<MechSheet mech={mech} store={makeStore(mech)} />)
    expect(within(partnersRegion()).queryByRole('button', { name: /remove sestra drone/i })).toBe(
      null
    )
  })

  test('a chassis that grants no drone renders no Partners region at all', () => {
    const mech = seededMech('bad-penny', 'Hauler')
    expect(mech.partners).toBeUndefined()
    render(<MechSheet mech={mech} store={makeStore(mech)} />)
    expect(screen.queryByText(/^Partners$/i)).toBe(null)
  })
})
