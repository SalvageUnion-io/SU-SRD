import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityIntegratedSystems } from '../ReferenceEntityIntegratedSystems'

/**
 * ReferenceEntityIntegratedSystems resolves an entity's `systems` string list
 * against the Systems dataset and renders each as a compact listing under an
 * "Integrated Systems" separator. The Defacer Drone integrates two real
 * systems; the Mule chassis has no `systems` field (the null branch).
 */
const drone = SalvageUnionReference.Drones.find((d) => d.name === 'Defacer Drone') as SURefEntity
const noSystems = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule') as SURefEntity

afterEach(() => cleanup())

describe('ReferenceEntityIntegratedSystems', () => {
  test('fixtures resolve', () => {
    expect(drone).toBeDefined()
    expect(noSystems).toBeDefined()
    // Confirm the fixture actually carries the systems the component resolves.
    expect((drone as { systems?: unknown }).systems).toEqual([
      'Hover Locomotion System',
      'Chainsaw Arm',
    ])
  })

  test('renders resolved system names under the Integrated Systems separator', () => {
    render(<ReferenceEntityIntegratedSystems data={drone} compact={false} />)
    expect(screen.getByText('Integrated Systems')).toBeTruthy()
    expect(screen.getByText('Hover Locomotion System')).toBeTruthy()
    expect(screen.getByText('Chainsaw Arm')).toBeTruthy()
  })

  test('renders nothing for an entity with no systems field', () => {
    const { container } = render(
      <ReferenceEntityIntegratedSystems data={noSystems} compact={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  test('renders nothing when the systems list is empty', () => {
    const empty = { id: 'x', name: 'Empty', systems: [] } as unknown as SURefEntity
    const { container } = render(<ReferenceEntityIntegratedSystems data={empty} compact={false} />)
    expect(container.firstChild).toBeNull()
  })

  test('renders nothing when no system name resolves to a real entity', () => {
    const unresolved = {
      id: 'x',
      name: 'Bogus',
      systems: ['No Such System'],
    } as unknown as SURefEntity
    const { container } = render(
      <ReferenceEntityIntegratedSystems data={unresolved} compact={false} />
    )
    expect(container.firstChild).toBeNull()
  })
})
