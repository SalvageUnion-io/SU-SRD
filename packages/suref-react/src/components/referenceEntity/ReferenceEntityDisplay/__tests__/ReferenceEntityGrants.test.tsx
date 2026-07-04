import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityGrants } from '../ReferenceEntityGrants'

/**
 * ReferenceEntityGrants resolves an ability's `grants` via
 * `resolveGrantedEntities` and renders a "Grants" separator followed by a
 * nested compact card per granted entity. Fixtures:
 *   - "Auto-Turret" grants a single equipment (also named Auto-Turret)
 *   - "Mecha Packmaster" grants two "Mecha Companion" entities (double-grant)
 *   - the Mule chassis grants nothing (the null branch)
 */
const singleGrant = SalvageUnionReference.Abilities.find(
  (a) => a.name === 'Auto-Turret'
) as SURefEntity
const doubleGrant = SalvageUnionReference.Abilities.find(
  (a) => a.name === 'Mecha Packmaster'
) as SURefEntity
const noGrant = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule') as SURefEntity

afterEach(() => cleanup())

describe('ReferenceEntityGrants', () => {
  test('fixtures resolve', () => {
    expect(singleGrant).toBeDefined()
    expect(doubleGrant).toBeDefined()
    expect(noGrant).toBeDefined()
  })

  test('renders a Grants section with the granted entity card', () => {
    render(<ReferenceEntityGrants data={singleGrant} compact={false} />)
    expect(screen.getByText('Grants')).toBeTruthy()
    // The nested card (only content rendered here) surfaces the granted name.
    expect(screen.getAllByText('Auto-Turret').length).toBeGreaterThan(0)
  })

  test('renders one nested card per granted entity (double-grant)', () => {
    render(<ReferenceEntityGrants data={doubleGrant} compact={false} />)
    expect(screen.getByText('Grants')).toBeTruthy()
    // Mecha Packmaster grants two Mecha Companions — two nested cards.
    expect(screen.getAllByText('Mecha Companion')).toHaveLength(2)
  })

  test('renders nothing when the entity grants nothing', () => {
    const { container } = render(<ReferenceEntityGrants data={noGrant} compact={false} />)
    expect(container.firstChild).toBeNull()
  })
})
