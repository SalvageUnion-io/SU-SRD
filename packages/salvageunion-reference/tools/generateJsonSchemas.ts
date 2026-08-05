#!/usr/bin/env tsx
/**
 * Generate JSON Schema files from Zod schemas
 * Uses Zod 4 native z.toJSONSchema() to convert Zod schemas to JSON Schema format
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
// The canonical schema-id -> Zod map lives in ModelFactory (one registry,
// audit item 23) — the generator no longer keeps its own copy.
import { zodSchemaMap } from '../lib/ModelFactory.js'
import { z } from '../lib/zod.js'
import { formatWithBiome } from './formatWithBiome.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const schemasDir = join(__dirname, '..', 'schemas')
const sharedDir = join(schemasDir, 'shared')

// Ensure directories exist
mkdirSync(sharedDir, { recursive: true })

const entitySchemaMap: Record<string, z.ZodType> = zodSchemaMap as Record<string, z.ZodType>

// Convert schema ID to schema filename
function schemaIdToFilename(schemaId: string): string {
  return `${schemaId}.schema.json`
}

// Generate JSON Schema for each entity schema
async function generateSchemas() {
  console.log('Generating JSON Schema files from Zod schemas...\n')

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

      // Format with Biome using the repo config and write to file. `schemas/`
      // is NOT biome-ignored, so the real path works as the stdin path here.
      const filename = schemaIdToFilename(schemaId)
      const filepath = join(schemasDir, filename)
      const formatted = formatWithBiome(JSON.stringify(arraySchema), filepath)
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
