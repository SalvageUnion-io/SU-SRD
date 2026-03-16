import { SalvageUnionReference } from 'salvageunion-reference'
import type { CargoRow } from '../../types/common'

export function partitionCargo(cargo: CargoRow[] | null | undefined): {
  entityItems: CargoRow[]
  customItems: CargoRow[]
} {
  const all = cargo ?? []
  return {
    entityItems: all.filter((c) => c.schema_ref_id),
    customItems: all.filter((c) => !c.schema_ref_id),
  }
}

export type CategoryFields = {
  techLevel?: boolean
  salvageValue?: boolean
  slotsRequired?: boolean
  structurePoints?: boolean
  energyPoints?: boolean
  heatCapacity?: boolean
}

export type CustomCargoFormData = {
  category: string
  description: string
  techLevel: string | undefined
  salvageValue: string
  slotsRequired: string
  structurePoints: string
  energyPoints: string
  heatCapacity: string
  fields: CategoryFields
}

export function buildCustomCargoMetadata(formData: CustomCargoFormData): Record<string, unknown> {
  const metadata: Record<string, unknown> = { category: formData.category }
  if (formData.description.trim()) metadata.description = formData.description.trim()
  if (formData.techLevel !== undefined && formData.fields.techLevel)
    metadata.tech_level = formData.techLevel
  if (formData.salvageValue && formData.fields.salvageValue)
    metadata.salvage_value = Number(formData.salvageValue)
  if (formData.slotsRequired && formData.fields.slotsRequired)
    metadata.slots_required = Number(formData.slotsRequired)
  if (formData.structurePoints && formData.fields.structurePoints)
    metadata.structure_points = Number(formData.structurePoints)
  if (formData.energyPoints && formData.fields.energyPoints)
    metadata.energy_points = Number(formData.energyPoints)
  if (formData.heatCapacity && formData.fields.heatCapacity)
    metadata.heat_capacity = Number(formData.heatCapacity)
  return metadata
}

export function resolveEntitySchema(entityId: string): { name: string; schemaName: string } | null {
  const chassis = SalvageUnionReference.get('chassis', entityId)
  if (chassis) return { name: chassis.name, schemaName: chassis.schemaName }
  const system = SalvageUnionReference.get('systems', entityId)
  if (system) return { name: system.name, schemaName: system.schemaName }
  const mod = SalvageUnionReference.get('modules', entityId)
  if (mod) return { name: mod.name, schemaName: mod.schemaName }
  return null
}
