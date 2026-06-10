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
// Helpers
// ---------------------------------------------------------------------------

/**
 * EntityChoiceCard renders ReferenceEntityDisplay with role="button" on the
 * card root (via DisplayCard's cardClickable wiring). Locate a card by its
 * entity name and return the clickable element. The name may be split across
 * text nodes in the card header, so match by accessible-name containment
 * rather than exact text.
 */
function getChoiceCardByName(name: string): HTMLElement {
  // The card root is a <div role="button"> (DisplayCard wiring). Internal
  // <button> tags inside the card also report role=button — prefer the div
  // root so the onClick from cardClick:true fires.
  const cardRoots = Array.from(document.querySelectorAll('div[role="button"]'))
  const card = cardRoots.find((b) => (b.textContent ?? '').includes(name))
  if (!card) throw new Error(`No card div[role=button] containing "${name}"`)
  return card as HTMLElement
}

// ---------------------------------------------------------------------------
// ChassisSelector tests
// ---------------------------------------------------------------------------

describe('ChassisSelector', () => {
  it('renders a card for each chassis from salvageunion-reference', () => {
    const onSelect = mock(() => {})
    render(<ChassisSelector selectedChassis={null} onSelect={onSelect} />)

    // Verify that at least two known chassis render as selectable cards
    const allChassis = SalvageUnionReference.Chassis.all()
    expect(allChassis.length).toBeGreaterThan(1)
    const firstTwo = allChassis.slice(0, 2)
    for (const c of firstTwo) {
      expect(screen.getAllByText(c.name).length).toBeGreaterThan(0)
    }
  })

  it('clicking a chassis card calls onSelect with the chassis name', async () => {
    const onSelect = mock(() => {})
    render(<ChassisSelector selectedChassis={null} onSelect={onSelect} />)

    const allChassis = SalvageUnionReference.Chassis.all()
    const firstChassis = allChassis[0]!

    await act(async () => {
      fireEvent.click(getChoiceCardByName(firstChassis.name))
    })

    expect(onSelect).toHaveBeenCalledWith(firstChassis.name)
  })

  it('shows a selected indicator on the chosen chassis', () => {
    const allChassis = SalvageUnionReference.Chassis.all()
    const mule = allChassis.find((c) => c.name === 'Mule') ?? allChassis[0]!
    render(<ChassisSelector selectedChassis={mule.name} onSelect={mock(() => {})} />)

    // EntityChoiceCard injects a control with ariaLabel starting "Selected"
    // when the card is the chosen one.
    const selectedIndicator = screen.getByLabelText(/^Selected/)
    expect(selectedIndicator).not.toBeNull()
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
// MechBuilder integration test — schema validation gate at submit
// ---------------------------------------------------------------------------

describe('MechBuilder — name gate', () => {
  it('keeps Next disabled and creates no mech when the name is empty', async () => {
    render(<MechBuilder />)

    // Select a chassis
    const allChassis = SalvageUnionReference.Chassis.all()
    const mule = allChassis.find((c) => c.name === 'Mule') ?? allChassis[0]!

    await act(async () => {
      fireEvent.click(getChoiceCardByName(mule.name))
    })

    // Advance Chassis -> Loadout -> Identity. With the name left empty the
    // wizard's Next button must stay disabled, so Review/Create is unreachable
    // and no mech can be persisted. (The MechSchema.safeParse gate in
    // handleSubmit remains as defence in depth but is unreachable from here.)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    })

    const nextButton = screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement
    expect(nextButton.disabled).toBe(true)
    // No mech was persisted to the store.
    const mechs = useEntityStore.getState().list('mech')
    expect(mechs.length).toBe(0)
  }, 30000)
})

// ---------------------------------------------------------------------------
// MechBuilder integration test — entityStore.create called on finish
// ---------------------------------------------------------------------------

describe('MechBuilder — submit', () => {
  // Rendering the full MechBuilder now mounts ~200 ReferenceEntityDisplay
  // cards for chassis selection plus another ~100 once systems/modules
  // reveal. The integration covers a real save through fake-indexeddb, so
  // bump the timeout past the 5 s default. CI runners are slower than
  // local; 30 s covers GitHub Actions' Ubuntu standard runner.
  it('calls entityStore.create with a valid Mech shape on submission', async () => {
    render(<MechBuilder />)

    // Step 1 — select a chassis by clicking its EntityChoiceCard
    const allChassis = SalvageUnionReference.Chassis.all()
    const mule = allChassis.find((c) => c.name === 'Mule') ?? allChassis[0]!

    await act(async () => {
      fireEvent.click(getChoiceCardByName(mule.name))
    })
    // Chassis -> Loadout
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    })
    // Loadout -> Identity
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    })

    // Step 3 — enter a mech name on the Identity step
    const nameInput = screen.getByRole('textbox', { name: /mech name/i })
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Iron Fist' } })
    })
    // Identity -> Review
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    })

    // Step 4 — submit from the Review step
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create mech/i }))
    })

    // Wait for the mech to appear in the store
    await waitFor(() => {
      const mechs = useEntityStore.getState().list('mech')
      expect(mechs.length).toBe(1)
      expect(mechs[0]!.name).toBe('Iron Fist')
      expect(mechs[0]!.chassisRef).toBe(mule.name)
      expect(mechs[0]!.systems).toEqual([])
      expect(mechs[0]!.modules).toEqual([])
      expect(mechs[0]!.cargoLots).toEqual([])
      expect(mechs[0]!.conditions).toEqual([])
      expect(mechs[0]!.schemaVersion).toBe(1)
    })
  }, 30000)
})
