/**
 * Tests for MechBuilder components (AC-2, #190).
 *
 * Tests cover:
 * - ChassisSelector renders and chassis selection updates form state
 * - Over-slot module selection surfaces a capacity violation in CapacityIndicator
 * - Cargo over-capacity surfaces a violation in CapacityIndicator
 * - Finishing the builder calls entityStore.create with a valid Mech shape
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 * salvageunion-reference is preloaded via beforeAll.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { useEntityStore } from '../../../stores/entityStore'
import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import { ChassisSelector } from '../ChassisSelector'
import { CapacityIndicator } from '../CapacityIndicator'
import { CargoEditor } from '../CargoEditor'
import { MechBuilder } from '../MechBuilder'
import type { MechCapacityResult } from '../../../lib/rules/types'
import type { CargoItem } from '../../../lib/rules/types'

// ---------------------------------------------------------------------------
// Pre-load reference data
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis', 'systems', 'modules', 'equipment'])
})

// ---------------------------------------------------------------------------
// Store reset helpers
// ---------------------------------------------------------------------------

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
  await useEntityStore.getState().hydrate('mech')
})

afterEach(async () => {
  await act(async () => {
    cleanup()
  })
  await _clearAllStores()
  resetEntityStore()
})

// ---------------------------------------------------------------------------
// ChassisSelector tests
// ---------------------------------------------------------------------------

describe('ChassisSelector', () => {
  it('renders a list of chassis from salvageunion-reference', async () => {
    const onSelect = mock(() => {})
    render(<ChassisSelector selectedChassis={null} onSelect={onSelect} />)

    // Should render at least one chassis option
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(1) // includes empty "select" option
  })

  it('selecting a chassis calls onSelect with the chassis name', async () => {
    const onSelect = mock(() => {})
    render(<ChassisSelector selectedChassis={null} onSelect={onSelect} />)

    const select = screen.getByRole('combobox')
    const allChassis = SalvageUnionReference.Chassis.all()
    const firstChassis = allChassis[0]!

    await act(async () => {
      fireEvent.change(select, { target: { value: firstChassis.name } })
    })

    expect(onSelect).toHaveBeenCalledWith(firstChassis.name)
  })

  it('shows selected chassis as the combobox value', () => {
    const allChassis = SalvageUnionReference.Chassis.all()
    const mule = allChassis.find((c) => c.name === 'Mule') ?? allChassis[0]!
    render(<ChassisSelector selectedChassis={mule.name} onSelect={mock(() => {})} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe(mule.name)
  })
})

// ---------------------------------------------------------------------------
// CapacityIndicator tests
// ---------------------------------------------------------------------------

describe('CapacityIndicator — slot display', () => {
  it('renders system and module slot counts', () => {
    const capacityResult: MechCapacityResult = {
      systemSlotsUsed: 4,
      systemSlotsMax: 16,
      moduleSlotsUsed: 1,
      moduleSlotsMax: 2,
      violations: [],
    }
    render(
      <CapacityIndicator
        capacity={capacityResult}
        cargoUsed={0}
        cargoMax={8}
        cargoViolations={[]}
      />
    )

    expect(screen.getByText(/4\s*\/\s*16/)).not.toBeNull()
    expect(screen.getByText(/1\s*\/\s*2/)).not.toBeNull()
  })

  it('renders a violation badge when modules are over-slot', () => {
    const capacityResult: MechCapacityResult = {
      systemSlotsUsed: 0,
      systemSlotsMax: 16,
      moduleSlotsUsed: 5,
      moduleSlotsMax: 2,
      violations: [
        {
          kind: 'module-over-slots',
          message: 'Module slots exceeded: 5 used, 2 available.',
          details: { used: 5, max: 2 },
        },
      ],
    }
    render(
      <CapacityIndicator
        capacity={capacityResult}
        cargoUsed={0}
        cargoMax={8}
        cargoViolations={[]}
      />
    )

    // Should show the over-slot violation badge by testid
    const violationEl = screen.getByTestId('violation-module-over-slots')
    expect(violationEl).not.toBeNull()
  })

  it('renders a cargo over-capacity violation badge', () => {
    const capacityResult: MechCapacityResult = {
      systemSlotsUsed: 0,
      systemSlotsMax: 16,
      moduleSlotsUsed: 0,
      moduleSlotsMax: 2,
      violations: [],
    }
    render(
      <CapacityIndicator
        capacity={capacityResult}
        cargoUsed={10}
        cargoMax={6}
        cargoViolations={[
          {
            kind: 'over-capacity',
            message: 'Cargo capacity exceeded: 10 slots used, 6 available.',
            details: { used: 10, max: 6 },
          },
        ]}
      />
    )

    const violationEl = screen.getByTestId('violation-cargo-over-capacity')
    expect(violationEl).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// CargoEditor tests
// ---------------------------------------------------------------------------

describe('CargoEditor', () => {
  it('renders with zero items initially', () => {
    const onChange = mock(() => {})
    render(<CargoEditor items={[]} onChange={onChange} />)

    // Should show empty state or no cargo items
    expect(screen.queryAllByTestId('cargo-item').length).toBe(0)
  })

  it('adding a custom item calls onChange with the new item', async () => {
    const onChange = mock(() => {})
    render(<CargoEditor items={[]} onChange={onChange} />)

    const nameInput = screen.getByPlaceholderText(/item name/i)
    const addButton = screen.getByRole('button', { name: /add/i })

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Rope' } })
      fireEvent.click(addButton)
    })

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ kind: 'custom', name: 'Rope' })])
    )
  })

  it('removing an item calls onChange without the removed item', async () => {
    const existingItems: CargoItem[] = [{ kind: 'custom', name: 'Rope', slotCount: 1 }]
    const onChange = mock(() => {})
    render(<CargoEditor items={existingItems} onChange={onChange} />)

    const removeButton = screen.getByRole('button', { name: /remove/i })
    await act(async () => {
      fireEvent.click(removeButton)
    })

    expect(onChange).toHaveBeenCalledWith([])
  })
})

// ---------------------------------------------------------------------------
// MechBuilder integration test — entityStore.create called on finish
// ---------------------------------------------------------------------------

describe('MechBuilder — submit', () => {
  it('calls entityStore.create with a valid Mech shape on submission', async () => {
    render(<MechBuilder />)

    // Select a chassis
    const chassisSelect = screen.getByRole('combobox', { name: /chassis/i })
    const allChassis = SalvageUnionReference.Chassis.all()
    const mule = allChassis.find((c) => c.name === 'Mule') ?? allChassis[0]!

    await act(async () => {
      fireEvent.change(chassisSelect, { target: { value: mule.name } })
    })

    // Enter a mech name
    const nameInput = screen.getByRole('textbox', { name: /mech name/i })
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Iron Fist' } })
    })

    // Submit
    const submitButton = screen.getByRole('button', { name: /create mech/i })
    await act(async () => {
      fireEvent.click(submitButton)
    })

    // Wait for the mech to appear in the store
    await waitFor(() => {
      const mechs = useEntityStore.getState().list('mech')
      expect(mechs.length).toBe(1)
      expect(mechs[0]!.name).toBe('Iron Fist')
      expect(mechs[0]!.chassisRef).toBe(mule.name)
      expect(mechs[0]!.systems).toEqual([])
      expect(mechs[0]!.modules).toEqual([])
      expect(mechs[0]!.cargo).toEqual([])
      expect(mechs[0]!.conditions).toEqual([])
      expect(mechs[0]!.schemaVersion).toBe(1)
    })
  })
})
