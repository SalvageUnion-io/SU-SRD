import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityRequirementDisplay } from '../ReferenceEntityRequirementDisplay'

/**
 * ReferenceEntityRequirementDisplay reads `getRequirement(data)` and renders
 * each required tree, joined by "OR". Fixtures come from the
 * ability-tree-requirements dataset:
 *   - "Advanced Engineer" requires a single tree ("Mech-Tech")
 *   - "Fabricator" requires two ("Forging" OR "Electronics")
 * The Mule chassis has no requirement (the null branch).
 */
const singleReq = SalvageUnionReference.AbilityTreeRequirements.find(
  (r) => r.name === 'Advanced Engineer'
) as SURefEntity
const multiReq = SalvageUnionReference.AbilityTreeRequirements.find(
  (r) => r.name === 'Fabricator'
) as SURefEntity
const noReq = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule') as SURefEntity

afterEach(() => cleanup())

describe('ReferenceEntityRequirementDisplay', () => {
  test('fixtures resolve', () => {
    expect(singleReq).toBeDefined()
    expect(multiReq).toBeDefined()
    expect(noReq).toBeDefined()
  })

  test('renders the single required tree under a Requirements label', () => {
    render(<ReferenceEntityRequirementDisplay data={singleReq} compact={false} />)
    expect(screen.getByText('Requirements')).toBeTruthy()
    // Name + " tree" render as adjacent nodes inside one bold span.
    expect(screen.getByText(/Mech-Tech/)).toBeTruthy()
    // A single requirement has no "OR" joiner.
    expect(screen.queryByText('OR')).toBeNull()
  })

  test('joins multiple required trees with OR', () => {
    render(<ReferenceEntityRequirementDisplay data={multiReq} compact={false} />)
    expect(screen.getByText(/Forging/)).toBeTruthy()
    expect(screen.getByText(/Electronics/)).toBeTruthy()
    expect(screen.getByText('OR')).toBeTruthy()
  })

  test('renders nothing when the entity has no requirement', () => {
    const { container } = render(<ReferenceEntityRequirementDisplay data={noReq} compact={false} />)
    expect(container.firstChild).toBeNull()
  })
})
