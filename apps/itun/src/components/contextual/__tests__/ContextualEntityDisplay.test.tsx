/**
 * Tests for ContextualEntityDisplay (AC-3, cycle-2).
 *
 * Strategy:
 * - Tests are dependency-injected through mocking component-lib's
 *   EntityTooltip so we don't need to render the full
 *   entity card (which has complex layout / font dependencies).
 * - We verify: correct schemaName + entityId forwarded, byName lookup,
 *   graceful fallback when entity not found.
 *
 * salvageunion-reference is preloaded in beforeAll so name → id resolution
 * (SalvageUnionReference.findIn) exercises real data.
 */

import { beforeAll, describe, expect, it, mock } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ContextualEntityDisplay } from 'component-lib'
import { must } from '../../__tests__/must'

// ---------------------------------------------------------------------------
// Mock EntityTooltip to avoid rendering the full card
// ---------------------------------------------------------------------------

mock.module('component-lib', () => ({
  EntityTooltip: ({
    schemaName,
    entityId,
    children,
  }: {
    schemaName: string
    entityId: string
    children: React.ReactNode
  }) => (
    <div data-testid="tooltip-wrapper" data-schema={schemaName} data-entity-id={entityId}>
      {children}
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// Pre-load reference data so findIn works
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis', 'systems', 'classes', 'abilities'])
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContextualEntityDisplay — byId', () => {
  it('passes schemaName and entityId to EntityTooltip', () => {
    const allClasses = SalvageUnionReference.Classes.all()
    const cls = must(allClasses[0])

    const { container } = render(
      <ContextualEntityDisplay schemaName="classes" entityId={cls.id}>
        <span>trigger</span>
      </ContextualEntityDisplay>
    )

    const wrapper = container.querySelector('[data-testid="tooltip-wrapper"]')
    expect(wrapper).toBeTruthy()
    expect(wrapper?.getAttribute('data-schema')).toBe('classes')
    expect(wrapper?.getAttribute('data-entity-id')).toBe(cls.id)
  })

  it('renders children inside the tooltip wrapper', () => {
    const allClasses = SalvageUnionReference.Classes.all()
    const cls = must(allClasses[0])

    const { container } = render(
      <ContextualEntityDisplay schemaName="classes" entityId={cls.id}>
        <span data-testid="child">My child</span>
      </ContextualEntityDisplay>
    )

    const child = container.querySelector('[data-testid="child"]')
    expect(child).toBeTruthy()
  })
})

describe('ContextualEntityDisplay — byName (chassis)', () => {
  it('resolves chassis name to id and passes it to tooltip', () => {
    const allChassis = SalvageUnionReference.Chassis.all()
    const chassis = must(allChassis[0])

    const { container } = render(
      <ContextualEntityDisplay schemaName="chassis" entityName={chassis.name}>
        <span>trigger</span>
      </ContextualEntityDisplay>
    )

    const wrapper = container.querySelector('[data-testid="tooltip-wrapper"]')
    expect(wrapper).toBeTruthy()
    expect(wrapper?.getAttribute('data-schema')).toBe('chassis')
    expect(wrapper?.getAttribute('data-entity-id')).toBe(chassis.id)
  })

  it('resolves system name to id', () => {
    const allSystems = SalvageUnionReference.Systems.all()
    const system = must(allSystems[0])

    const { container } = render(
      <ContextualEntityDisplay schemaName="systems" entityName={system.name}>
        <button type="button">system button</button>
      </ContextualEntityDisplay>
    )

    const wrapper = container.querySelector('[data-testid="tooltip-wrapper"]')
    expect(wrapper).toBeTruthy()
    expect(wrapper?.getAttribute('data-entity-id')).toBe(system.id)
  })
})

describe('ContextualEntityDisplay — fallback', () => {
  it('renders children unwrapped when entity not found by name', () => {
    const { container } = render(
      <ContextualEntityDisplay schemaName="chassis" entityName="__nonexistent_chassis__">
        <span data-testid="child">bare child</span>
      </ContextualEntityDisplay>
    )

    // No tooltip wrapper
    expect(container.querySelector('[data-testid="tooltip-wrapper"]')).toBeFalsy()
    // But children still render
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy()
  })

  it('renders children unwrapped when entityId is empty string', () => {
    const { container } = render(
      <ContextualEntityDisplay schemaName="classes" entityId="">
        <span data-testid="child">bare child</span>
      </ContextualEntityDisplay>
    )

    expect(container.querySelector('[data-testid="tooltip-wrapper"]')).toBeFalsy()
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy()
  })
})
