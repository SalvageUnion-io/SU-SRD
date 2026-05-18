import { describe, it, expect } from 'bun:test'
import { getIncompletePilots } from './downtimePreSessionUtils'
import type { PilotRow } from '../types/common'
import type { CraftReceipt, CraftedItem } from './craftUtils'
import type { TrainingReceipt } from './trainingUtils'
import type { EquipmentReceipt } from './equipmentUtils'

function makePilot(id: string, callsign: string): PilotRow {
  return {
    id,
    callsign,
    user_id: 'user-1',
    crawler_id: 'crawler-1',
    active: true,
    ap: 3,
    max_ap: 3,
    appearance: null,
    background: null,
    background_used: null,
    class_ref: 'scavenger',
    hp: 10,
    max_hp: 10,
    image_path: null,
    in_downtime: false,
    is_boarded: false,
    keepsake: null,
    keepsake_used: null,
    mech_id: null,
    motto: null,
    motto_used: null,
    notes: null,
    tp: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    visible: true,
  } as PilotRow
}

function makeCraftedItem(): CraftedItem {
  return { schema_name: 'systems', ref_id: 'item-1', name: 'Widget', scrap_cost: 2, scrap_tl: 1 }
}

function makeCraftReceipt(overrides: Partial<CraftReceipt> = {}): CraftReceipt {
  return { crafted_items: [], ...overrides }
}

function makeTrainingReceipt(overrides: Partial<TrainingReceipt> = {}): TrainingReceipt {
  return { tp_granted: 0, abilities_learned: [], tp_remaining: 0, ...overrides }
}

function makeEquipmentReceipt(overrides: Partial<EquipmentReceipt> = {}): EquipmentReceipt {
  return { item: null, ...overrides }
}

describe('getIncompletePilots', () => {
  it('returns empty array when all pilots have completed all optional steps', () => {
    const pilots = [makePilot('p1', 'Blaze'), makePilot('p2', 'Nova')]
    const craftReceipts: Record<string, CraftReceipt> = {
      p1: makeCraftReceipt({ crafted_items: [makeCraftedItem()] }),
      p2: makeCraftReceipt({ skipped: true }),
    }
    const trainingReceipts: Record<string, TrainingReceipt> = {
      p1: makeTrainingReceipt({
        abilities_learned: [{ ref_id: 'ability-1', name: 'Toughness', tp_cost: 1 }],
      }),
      p2: makeTrainingReceipt({ skipped: true }),
    }
    const equipmentReceipts: Record<string, EquipmentReceipt> = {
      p1: makeEquipmentReceipt({ item: { ref_id: 'eq-1', name: 'Gear' } }),
      p2: makeEquipmentReceipt({ skipped: true }),
    }

    const result = getIncompletePilots(pilots, craftReceipts, trainingReceipts, equipmentReceipts)
    expect(result).toEqual([])
  })

  it('returns pilot missing craft step', () => {
    const pilots = [makePilot('p1', 'Blaze')]
    const craftReceipts: Record<string, CraftReceipt> = {
      p1: makeCraftReceipt(), // no crafted items, not skipped
    }
    const trainingReceipts: Record<string, TrainingReceipt> = {
      p1: makeTrainingReceipt({ skipped: true }),
    }
    const equipmentReceipts: Record<string, EquipmentReceipt> = {
      p1: makeEquipmentReceipt({ item: { ref_id: 'eq-1', name: 'Gear' } }),
    }

    const result = getIncompletePilots(pilots, craftReceipts, trainingReceipts, equipmentReceipts)
    expect(result).toHaveLength(1)
    expect(result[0]!.callsign).toBe('Blaze')
  })

  it('returns pilot missing training step', () => {
    const pilots = [makePilot('p1', 'Blaze')]
    const craftReceipts: Record<string, CraftReceipt> = {
      p1: makeCraftReceipt({ skipped: true }),
    }
    const trainingReceipts: Record<string, TrainingReceipt> = {
      p1: makeTrainingReceipt(), // no abilities learned, not skipped
    }
    const equipmentReceipts: Record<string, EquipmentReceipt> = {
      p1: makeEquipmentReceipt({ item: { ref_id: 'eq-1', name: 'Gear' } }),
    }

    const result = getIncompletePilots(pilots, craftReceipts, trainingReceipts, equipmentReceipts)
    expect(result).toHaveLength(1)
    expect(result[0]!.callsign).toBe('Blaze')
  })

  it('returns pilot missing equipment step', () => {
    const pilots = [makePilot('p1', 'Blaze')]
    const craftReceipts: Record<string, CraftReceipt> = {
      p1: makeCraftReceipt({ skipped: true }),
    }
    const trainingReceipts: Record<string, TrainingReceipt> = {
      p1: makeTrainingReceipt({ skipped: true }),
    }
    const equipmentReceipts: Record<string, EquipmentReceipt> = {
      p1: makeEquipmentReceipt(), // no item, not skipped
    }

    const result = getIncompletePilots(pilots, craftReceipts, trainingReceipts, equipmentReceipts)
    expect(result).toHaveLength(1)
    expect(result[0]!.callsign).toBe('Blaze')
  })

  it('returns only incomplete pilots when some are done', () => {
    const pilots = [makePilot('p1', 'Blaze'), makePilot('p2', 'Nova')]
    const craftReceipts: Record<string, CraftReceipt> = {
      p1: makeCraftReceipt({ skipped: true }),
      p2: makeCraftReceipt(), // incomplete
    }
    const trainingReceipts: Record<string, TrainingReceipt> = {
      p1: makeTrainingReceipt({ skipped: true }),
      p2: makeTrainingReceipt({ skipped: true }),
    }
    const equipmentReceipts: Record<string, EquipmentReceipt> = {
      p1: makeEquipmentReceipt({ skipped: true }),
      p2: makeEquipmentReceipt({ skipped: true }),
    }

    const result = getIncompletePilots(pilots, craftReceipts, trainingReceipts, equipmentReceipts)
    expect(result).toHaveLength(1)
    expect(result[0]!.callsign).toBe('Nova')
  })

  it('returns pilot with no receipts at all as incomplete', () => {
    const pilots = [makePilot('p1', 'Blaze')]

    const result = getIncompletePilots(pilots, null, null, null)
    expect(result).toHaveLength(1)
    expect(result[0]!.callsign).toBe('Blaze')
  })

  it('returns empty array for empty pilots list', () => {
    const result = getIncompletePilots([], null, null, null)
    expect(result).toEqual([])
  })
})
