import { SalvageUnionReference } from 'salvageunion-reference'
import type { BayNpcData } from '../types/common'

// Well-known bay names
const CRAFTING_BAY = 'Crafting Bay'
const MECH_BAY = 'Mech Bay'
const PILOT_BAY = 'Pilot Bay'
const CANTINA = 'Cantina'

/** Look up a bay's ID by name from the reference data */
function getBayId(bayName: string): string | undefined {
  const bay = SalvageUnionReference.findIn('crawler-bays', (b) => b.name === bayName)
  return bay?.id
}

/** Check if a specific bay is damaged */
function isBayDamaged(bayNpcs: Record<string, BayNpcData>, bayName: string): boolean {
  const bayId = getBayId(bayName)
  if (!bayId) return false
  return bayNpcs[bayId]?.damaged === true
}

export function isCraftingBayDamaged(bayNpcs: Record<string, BayNpcData>): boolean {
  return isBayDamaged(bayNpcs, CRAFTING_BAY)
}

export function isMechBayDamaged(bayNpcs: Record<string, BayNpcData>): boolean {
  return isBayDamaged(bayNpcs, MECH_BAY)
}

export function isPilotBayDamaged(bayNpcs: Record<string, BayNpcData>): boolean {
  return isBayDamaged(bayNpcs, PILOT_BAY)
}

export function isCantinaDamaged(bayNpcs: Record<string, BayNpcData>): boolean {
  return isBayDamaged(bayNpcs, CANTINA)
}
