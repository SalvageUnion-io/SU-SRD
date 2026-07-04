import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../index'

/**
 * End-to-end render coverage for the top-level ReferenceEntityDisplay across
 * entity shapes not exercised by the drone/bio-titan statblock test: a chassis
 * and a pilot ability. Also pins the guard branches (missing data /
 * schemaName) and the two card-level display-state flags that surface as DOM
 * observables — `damaged` (grey header) and `disabled` (dimmed content).
 */
const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule') as SURefEntity
const ability = SalvageUnionReference.Abilities.find(
  (a) => a.name === 'Engineering Expertise'
) as SURefEntity

afterEach(() => cleanup())

describe('ReferenceEntityDisplay (top-level render)', () => {
  test('fixtures resolve', () => {
    expect(mule).toBeDefined()
    expect(ability).toBeDefined()
  })

  test('renders a chassis with its name and stats', () => {
    render(<ReferenceEntityDisplay data={mule} />)
    // The name appears in the header (and again in the patterns/sticky areas).
    expect(screen.getAllByText('Mule').length).toBeGreaterThan(0)
    // Full-mode stat labels from ENTITY_STATS_CONFIG.
    expect(screen.getByText('Structure')).toBeTruthy()
    expect(screen.getByText('Salvage')).toBeTruthy()
  })

  test('renders an ability with its name', () => {
    render(<ReferenceEntityDisplay data={ability} />)
    expect(screen.getByText('Engineering Expertise')).toBeTruthy()
  })

  test('renders nothing when data is undefined', () => {
    const { container } = render(<ReferenceEntityDisplay data={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  test('renders nothing when data lacks a schemaName', () => {
    const noSchema = { id: 'x', name: 'No Schema' } as unknown as SURefEntity
    const { container } = render(<ReferenceEntityDisplay data={noSchema} />)
    expect(container.firstChild).toBeNull()
  })

  test('damaged applies the grey header treatment', () => {
    const { container: normal } = render(<ReferenceEntityDisplay data={mule} />)
    expect(normal.innerHTML).not.toContain('bg-su-grey')
    cleanup()
    const { container: damaged } = render(<ReferenceEntityDisplay data={mule} damaged />)
    expect(damaged.innerHTML).toContain('bg-su-grey')
  })

  test('disabled dims the card body via reduced opacity', () => {
    const { container: enabled } = render(<ReferenceEntityDisplay data={mule} />)
    expect(enabled.innerHTML).not.toContain('opacity: 0.5')
    cleanup()
    const { container: disabled } = render(<ReferenceEntityDisplay data={mule} disabled />)
    expect(disabled.innerHTML).toContain('opacity: 0.5')
  })
})
