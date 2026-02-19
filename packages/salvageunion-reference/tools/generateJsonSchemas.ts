#!/usr/bin/env tsx
/**
 * Generate JSON Schema files from Zod schemas
 * Uses Zod 4 native z.toJSONSchema() to convert Zod schemas to JSON Schema format
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { z } from 'zod'
import * as prettier from 'prettier'

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
  GuideSchema,
  CatalogCategorySchema,
} from '../lib/schemas/entities.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const schemasDir = join(__dirname, '..', 'schemas')
const sharedDir = join(schemasDir, 'shared')

// Ensure directories exist
mkdirSync(sharedDir, { recursive: true })

// Schema mapping: schema ID -> Zod schema
const entitySchemaMap: Record<string, z.ZodType> = {
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
  guides: GuideSchema,
  keywords: KeywordSchema,
  meld: MeldSchema,
  modules: ModuleSchema,
  npcs: NPCSchema,
  'roll-tables': RollTableSchema,
  squads: SquadSchema,
  systems: SystemSchema,
  traits: TraitEntitySchema,
  vehicles: VehicleSchema,
  'catalog-categories': CatalogCategorySchema,
}

// Convert schema ID to schema filename
function schemaIdToFilename(schemaId: string): string {
  return `${schemaId}.schema.json`
}

// Generate JSON Schema for each entity schema
async function generateSchemas() {
  console.log('Generating JSON Schema files from Zod schemas...\n')

  // Resolve Prettier config from project root
  const prettierConfig = await prettier.resolveConfig(schemasDir)

  for (const [schemaId, zodSchema] of Object.entries(entitySchemaMap)) {
    try {
      console.log(`Generating ${schemaId}...`)

      // Convert Zod schema to JSON Schema using Zod 4 native API
      const itemSchema = z.toJSONSchema(zodSchema, {
        target: 'draft-07',
        unrepresentable: 'any',
      })

      // Wrap in array schema (all entity schemas are arrays)
      const arraySchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: `https://salvageunion.com/schemas/${schemaIdToFilename(schemaId)}`,
        title: schemaId,
        description: (itemSchema as { description?: string })?.description || '',
        type: 'array' as const,
        items: itemSchema,
      }

      // Format with Prettier using project config and write to file
      const filename = schemaIdToFilename(schemaId)
      const filepath = join(schemasDir, filename)
      const formatted = await prettier.format(JSON.stringify(arraySchema), {
        ...prettierConfig,
        parser: 'json',
      })
      writeFileSync(filepath, formatted)

      console.log(`✓ Generated ${filename}`)
    } catch (error) {
      console.error(`✗ Error generating ${schemaId}:`, error)
      throw error
    }
  }

  console.log('\n✓ All JSON Schema files generated successfully!')
}

generateSchemas()
