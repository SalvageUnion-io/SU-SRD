import type { EntitySchemaName } from 'salvageunion-reference'
import { SalvageUnionReference, getSalvageValue, getTechLevelNumber } from 'salvageunion-reference'
import type { CargoRow } from '../types/common'

export type CargoDecision = 'scrap' | 'storage'

export type RawScrapGroup = {
  techLevel: number
  amount: number
}

export type TalliedEntityItem = {
  cargoId: string
  name: string
  schemaName: string
  schemaRefId: string
  techLevel: number
  salvageValue: number
}

export type TallySummary = {
  scrapByTL: Record<number, number>
  storageItems: TalliedEntityItem[]
}

/**
 * Separate raw scrap items from entity items in cargo.
 * Raw scrap = no schema_ref_id, has metadata.tech_level
 * Entity items = has schema_ref_id
 */
export function categorizeCargoItems(cargo: CargoRow[]): {
  rawScrap: RawScrapGroup[]
  entityItems: TalliedEntityItem[]
} {
  const scrapMap = new Map<number, number>()
  const entityItems: TalliedEntityItem[] = []

  for (const row of cargo) {
    if (row.schema_ref_id && row.schema_name) {
      // Entity item — resolve tech level and salvage value from reference data
      const entity = SalvageUnionReference.get(
        row.schema_name as EntitySchemaName,
        row.schema_ref_id
      )
      const tl = entity ? (getTechLevelNumber(entity) ?? 1) : 1
      const sv = entity ? (getSalvageValue(entity) ?? 1) : 1

      entityItems.push({
        cargoId: row.id,
        name: entity?.name ?? row.name,
        schemaName: row.schema_name,
        schemaRefId: row.schema_ref_id,
        techLevel: tl,
        salvageValue: sv,
      })
    } else {
      // Raw scrap — aggregate by tech level
      const metadata = row.metadata as Record<string, unknown> | null
      const tl = Number(metadata?.tech_level ?? 1)
      const current = scrapMap.get(tl) ?? 0
      scrapMap.set(tl, current + row.amount)
    }
  }

  const rawScrap: RawScrapGroup[] = Array.from(scrapMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([techLevel, amount]) => ({ techLevel, amount }))

  return { rawScrap, entityItems }
}

/**
 * Compute totals: scrap per TL (raw + converted entities), items going to storage.
 */
export function computeTallySummary(
  rawScrap: RawScrapGroup[],
  entityItems: TalliedEntityItem[],
  decisions: Record<string, CargoDecision>
): TallySummary {
  const scrapByTL: Record<number, number> = {}

  // Add raw scrap
  for (const { techLevel, amount } of rawScrap) {
    scrapByTL[techLevel] = (scrapByTL[techLevel] ?? 0) + amount
  }

  // Add entity items marked as scrap
  const storageItems: TalliedEntityItem[] = []
  for (const item of entityItems) {
    const decision = decisions[item.cargoId] ?? 'scrap'
    if (decision === 'scrap') {
      scrapByTL[item.techLevel] = (scrapByTL[item.techLevel] ?? 0) + item.salvageValue
    } else {
      storageItems.push(item)
    }
  }

  return { scrapByTL, storageItems }
}

/**
 * Build the RPC payload from decisions.
 */
export function buildOffloadPayload(
  rawScrap: RawScrapGroup[],
  entityItems: TalliedEntityItem[],
  decisions: Record<string, CargoDecision>
): {
  storageCargoIds: string[]
  scrapAdditions: Record<string, number>
} {
  const scrapAdditions: Record<string, number> = {}

  // Raw scrap always goes to crawler scrap fields
  for (const { techLevel, amount } of rawScrap) {
    const key = String(techLevel)
    scrapAdditions[key] = (scrapAdditions[key] ?? 0) + amount
  }

  // Entity items based on decisions
  const storageCargoIds: string[] = []
  for (const item of entityItems) {
    const decision = decisions[item.cargoId] ?? 'scrap'
    if (decision === 'storage') {
      storageCargoIds.push(item.cargoId)
    } else {
      const key = String(item.techLevel)
      scrapAdditions[key] = (scrapAdditions[key] ?? 0) + item.salvageValue
    }
  }

  return { storageCargoIds, scrapAdditions }
}
