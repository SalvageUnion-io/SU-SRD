import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../index'

/**
 * Regression guard for the "titanic statblock" render gate. The Iron Lady moved
 * from `titans` to `drones`, so the gate that renders equipped systems/modules
 * (and surfaces bio-salvage) is keyed on data shape (actions + equipment) rather
 * than a single schema name. These tests pin that behaviour:
 *
 *  - the Iron Lady (a drone WITH actions + modules) gets the statblock treatment;
 *  - an ordinary drone (systems but NO actions) does NOT — its systems must not
 *    render as the "Mech Systems" equipment section;
 *  - a Bio-Titan surfaces a derived bio-salvage value.
 *
 * "Mech Systems" / "Mech Modules" section headings are emitted only by the
 * statblock-equipment path, so their presence/absence is a faithful proxy.
 */

const ironLady = SalvageUnionReference.Drones.find((d) => d.name === 'The Iron Lady')
const plainDrone = SalvageUnionReference.Drones.find((d) => d.name === 'Defacer Drone')
const bioTitan = SalvageUnionReference.BioTitans.find((t) => t.name === 'Scylla')

afterEach(() => cleanup())

describe('statblock-equipment render gate', () => {
  test('fixtures resolve', () => {
    expect(ironLady).toBeDefined()
    expect(plainDrone).toBeDefined()
    expect(bioTitan).toBeDefined()
    // plainDrone has systems but no actions — the case the gate must exclude
    expect(Array.isArray((plainDrone as { systems?: unknown }).systems)).toBe(true)
    expect('actions' in (plainDrone as object)).toBe(false)
  })

  test('Iron Lady (drone with actions + modules) renders her equipped Mech Modules', () => {
    render(<ReferenceEntityDisplay data={ironLady} />)
    expect(screen.getByText('Mech Modules')).toBeTruthy()
    expect(screen.getByText('Comms Module')).toBeTruthy()
  })

  test('Iron Lady shows a drone-style Salvage Value (not bio-salvage)', () => {
    render(<ReferenceEntityDisplay data={ironLady} />)
    expect(screen.getByText('Salvage')).toBeTruthy()
    // She is not a Bio-Titan, so no derived bio-salvage stat
    expect(screen.queryByText('Bio')).toBeNull()
  })

  test('an ordinary drone (systems, no actions) does NOT get the statblock treatment', () => {
    render(<ReferenceEntityDisplay data={plainDrone} />)
    expect(screen.queryByText('Mech Systems')).toBeNull()
  })

  test('a Bio-Titan surfaces a derived bio-salvage value', () => {
    render(<ReferenceEntityDisplay data={bioTitan} />)
    expect(screen.getByText('Bio')).toBeTruthy()
  })
})
