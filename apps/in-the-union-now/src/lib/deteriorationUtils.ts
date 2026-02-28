import { SalvageUnionReference } from 'salvageunion-reference'
import type { BayNpcData, CrawlerRow, CrawlerUpdate } from '../types/common'

export type UpkeepResult = {
  type: 'paid' | 'deteriorated'
  rollKey?: string
  rollText?: string
  spLost: number
  bayDamagedId: string | null
  bayDamagedName: string | null
  selectionMethod?: 'none' | 'random' | 'player'
  upgradePoolGained: number
}

/**
 * Pick a random undamaged bay from the crawler's bay_npcs.
 * Returns the bay ID or null if all bays are already damaged.
 */
export function pickRandomUndamagedBay(
  bayNpcs: Record<string, BayNpcData>,
  allBayIds: string[]
): string | null {
  const undamaged = allBayIds.filter((id) => !bayNpcs[id]?.damaged)
  if (undamaged.length === 0) return null
  return undamaged[Math.floor(Math.random() * undamaged.length)]!
}

/**
 * Build the deterioration result from a roll key.
 * For key "6-10" this returns selectionMethod: 'player' with bayDamagedId: null
 * — the caller must handle the player-selection sub-flow.
 * For keys "2-5" and "1", a random bay is picked automatically.
 */
export function buildDeteriorationResult(
  rollKey: string,
  rollText: string,
  bayNpcs: Record<string, BayNpcData>,
  allBays: Array<{ id: string; name: string }>
): UpkeepResult {
  const allBayIds = allBays.map((b) => b.id)

  switch (rollKey) {
    case '20': {
      return {
        type: 'deteriorated',
        rollKey,
        rollText,
        spLost: 0,
        bayDamagedId: null,
        bayDamagedName: null,
        selectionMethod: 'none',
        upgradePoolGained: 0,
      }
    }
    case '11-19': {
      return {
        type: 'deteriorated',
        rollKey,
        rollText,
        spLost: 5,
        bayDamagedId: null,
        bayDamagedName: null,
        selectionMethod: 'none',
        upgradePoolGained: 0,
      }
    }
    case '6-10': {
      // Player must choose — return placeholder
      return {
        type: 'deteriorated',
        rollKey,
        rollText,
        spLost: 0,
        bayDamagedId: null,
        bayDamagedName: null,
        selectionMethod: 'player',
        upgradePoolGained: 0,
      }
    }
    case '2-5': {
      const bayId = pickRandomUndamagedBay(bayNpcs, allBayIds)
      const bayName = bayId ? (allBays.find((b) => b.id === bayId)?.name ?? null) : null
      return {
        type: 'deteriorated',
        rollKey,
        rollText,
        spLost: 0,
        bayDamagedId: bayId,
        bayDamagedName: bayName,
        selectionMethod: 'random',
        upgradePoolGained: 0,
      }
    }
    case '1': {
      const bayId = pickRandomUndamagedBay(bayNpcs, allBayIds)
      const bayName = bayId ? (allBays.find((b) => b.id === bayId)?.name ?? null) : null
      return {
        type: 'deteriorated',
        rollKey,
        rollText,
        spLost: 5,
        bayDamagedId: bayId,
        bayDamagedName: bayName,
        selectionMethod: 'random',
        upgradePoolGained: 0,
      }
    }
    default: {
      // Fallback: treat unknown keys as no effect
      return {
        type: 'deteriorated',
        rollKey,
        rollText,
        spLost: 0,
        bayDamagedId: null,
        bayDamagedName: null,
        selectionMethod: 'none',
        upgradePoolGained: 0,
      }
    }
  }
}

/**
 * Compute the crawler update object for a deterioration result.
 * Returns an empty object if no crawler fields need changing (e.g. key "20").
 */
export function computeCrawlerDeteriorationUpdate(
  result: UpkeepResult,
  crawler: CrawlerRow
): CrawlerUpdate {
  const update: CrawlerUpdate = {}

  // SP loss
  if (result.spLost > 0) {
    update.current_sp = Math.max(0, crawler.current_sp - result.spLost)
  }

  // Bay damage
  if (result.bayDamagedId) {
    const bayNpcs = (crawler.bay_npcs ?? {}) as Record<string, BayNpcData>
    update.bay_npcs = {
      ...bayNpcs,
      [result.bayDamagedId]: {
        ...bayNpcs[result.bayDamagedId],
        damaged: true,
      },
    }
  }

  return update
}

/**
 * Build a simple "paid" result for the can-afford path.
 */
export function buildPaidResult(upgradePoolGained: number): UpkeepResult {
  return {
    type: 'paid',
    spLost: 0,
    bayDamagedId: null,
    bayDamagedName: null,
    upgradePoolGained,
  }
}

/** Get all crawler bays from reference data (convenience wrapper). */
export function getAllBays(): Array<{ id: string; name: string }> {
  return SalvageUnionReference.CrawlerBays.all().map((b) => ({ id: b.id, name: b.name }))
}
