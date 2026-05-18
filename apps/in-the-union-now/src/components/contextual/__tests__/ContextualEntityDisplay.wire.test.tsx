/**
 * Wire-in tests: ChassisSelector with ContextualEntityDisplay.
 *
 * Verifies that after selecting a chassis, the contextual display is shown
 * (the "Hover to preview" hint is visible, indicating the ContextualEntityDisplay
 * wrapper has rendered).
 */

import { beforeAll, describe, expect, it, mock } from 'bun:test'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ChassisSelector } from '../../mech/ChassisSelector'

// Mock ReferenceEntityDisplayTooltip to render a stable wrapper
mock.module('suref-react', () => ({
  ReferenceEntityDisplayTooltip: ({
    schemaName,
    entityId,
    children,
  }: {
    schemaName: string
    entityId: string
    children: React.ReactNode
  }) => (
    <div data-testid="contextual-display" data-schema={schemaName} data-entity-id={entityId}>
      {children}
    </div>
  ),
}))

beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis'])
})

describe('ChassisSelector + ContextualEntityDisplay wire-in', () => {
  it('renders no contextual display before a chassis is selected', () => {
    const { container } = render(<ChassisSelector selectedChassis={null} onSelect={() => {}} />)
    expect(container.querySelector('[data-testid="contextual-display"]')).toBeFalsy()
  })

  it('renders contextual display for selected chassis', () => {
    const allChassis = SalvageUnionReference.Chassis.all()
    const chassis = allChassis[0]!

    const { container } = render(
      <ChassisSelector selectedChassis={chassis.name} onSelect={() => {}} />
    )

    const display = container.querySelector('[data-testid="contextual-display"]')
    expect(display).toBeTruthy()
    expect(display?.getAttribute('data-schema')).toBe('chassis')
  })

  it('contextual display updates when chassis selection changes', async () => {
    const allChassis = SalvageUnionReference.Chassis.all()
    const firstChassis = allChassis[0]!
    const secondChassis = allChassis[1] ?? firstChassis

    let selected: string | null = null
    const onSelect = (name: string) => {
      selected = name
    }

    const { container, rerender } = render(
      <ChassisSelector selectedChassis={selected} onSelect={onSelect} />
    )

    // Initially no display
    expect(container.querySelector('[data-testid="contextual-display"]')).toBeFalsy()

    // Select first chassis via dropdown
    const select = screen.getByRole('combobox')
    await act(async () => {
      fireEvent.change(select, { target: { value: firstChassis.name } })
    })

    // Re-render with the updated selection
    rerender(<ChassisSelector selectedChassis={firstChassis.name} onSelect={onSelect} />)

    const display = container.querySelector('[data-testid="contextual-display"]')
    expect(display).toBeTruthy()

    // Switch to second chassis
    await act(async () => {
      fireEvent.change(select, { target: { value: secondChassis.name } })
    })
    rerender(<ChassisSelector selectedChassis={secondChassis.name} onSelect={onSelect} />)

    const display2 = container.querySelector('[data-testid="contextual-display"]')
    expect(display2).toBeTruthy()
  })
})
