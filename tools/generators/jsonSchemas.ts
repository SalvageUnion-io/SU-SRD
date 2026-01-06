#!/usr/bin/env bun
/**
 * Generate JSON Schema files from Zod schemas
 * Uses zod-to-json-schema to convert Zod schemas to JSON Schema format
 */

import { join } from 'path'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { z } from 'zod'

// Import all entity schemas
import {
  AbilitySchema,
  AbilityTreeRequirementSchema,
  MetaActionSchema,
  BioTitanSchema,
  ChassisSchema,
  ClassSchema,
  CrawlerBaySchema,
  CrawlerTechLevelSchema,
  CrawlerSchema,
  CreatureSchema,
  DistanceSchema,
  DroneSchema,
  EquipmentSchema,
  FactionSchema,
  KeywordSchema,
  MeldSchema,
  ModuleSchema,
  NPCSchema,
  RollTableSchema,
  SquadSchema,
  SystemSchema,
  TraitEntitySchema,
  VehicleSchema,
} from '../../src/reference/schemas/entities.js'

// Schema mapping: schema ID -> Zod schema
const entitySchemaMap: Record<string, z.ZodType<unknown>> = {
  abilities: AbilitySchema,
  'ability-tree-requirements': AbilityTreeRequirementSchema,
  actions: MetaActionSchema,
  'bio-titans': BioTitanSchema,
  chassis: ChassisSchema,
  classes: ClassSchema,
  'crawler-bays': CrawlerBaySchema,
  'crawler-tech-levels': CrawlerTechLevelSchema,
  crawlers: CrawlerSchema,
  creatures: CreatureSchema,
  distances: DistanceSchema,
  drones: DroneSchema,
  equipment: EquipmentSchema,
  factions: FactionSchema,
  keywords: KeywordSchema,
  meld: MeldSchema,
  modules: ModuleSchema,
  npcs: NPCSchema,
  'roll-tables': RollTableSchema,
  squads: SquadSchema,
  systems: SystemSchema,
  traits: TraitEntitySchema,
  vehicles: VehicleSchema,
}

// Convert schema ID to schema filename
function schemaIdToFilename(schemaId: string): string {
  return `${schemaId}.schema.json`
}

async function main() {
  const schemasDir = join(import.meta.dir, '..', '..', 'src', 'reference', 'schemas')

  // Generate JSON Schema for each entity schema
  console.log('Generating JSON Schema files from Zod schemas...\n')

  for (const [schemaId, zodSchema] of Object.entries(entitySchemaMap)) {
    try {
      console.log(`Generating ${schemaId}...`)

      // Convert Zod schema to JSON Schema
      const jsonSchema = zodToJsonSchema(zodSchema, {
        name: schemaId,
        target: 'jsonSchema7',
        strictUnions: false,
      })

      // Wrap in array schema (all entity schemas are arrays)
      const arraySchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: `https://salvageunion.com/schemas/${schemaIdToFilename(schemaId)}`,
        title: schemaId,
        description: (jsonSchema as { description?: string })?.description || '',
        type: 'array' as const,
        items: jsonSchema,
      }

      // Write to file
      const filename = schemaIdToFilename(schemaId)
      const filepath = join(schemasDir, filename)
      await Bun.write(filepath, JSON.stringify(arraySchema, null, 2) + '\n')

      console.log(`✓ Generated ${filename}`)
    } catch (error) {
      console.error(`✗ Error generating ${schemaId}:`, error)
      throw error
    }
  }

  console.log('\n✓ All JSON Schema files generated successfully!')
}

// Export for use as module
export default main

// Run directly if called as script
if (import.meta.main) {
  await main()
}
