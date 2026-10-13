import fs from 'node:fs'
import path from 'node:path'
import { registry } from '../lib/schemas/registry'
import { formatWithBiome } from './formatWithBiome'

/**
 * Every path below is anchored to THIS FILE, not to `process.cwd()`, so the
 * output does not depend on where the generator is invoked from.
 */
const PACKAGE_DIR = path.join(import.meta.dir, '..')

type SchemaInfo = {
  id: string
  title: string
  description: string
  comment?: string
  dataFile: string
  schemaFile: string
  itemCount: number
}

// Get all schema files
function getSchemaFiles(): string[] {
  const schemasDir = path.join(PACKAGE_DIR, 'schemas')
  return fs
    .readdirSync(schemasDir)
    .filter((file) => file.endsWith('.schema.json') && file !== 'index.json')
    .sort()
}

// Get item count from data file
function getItemCount(dataFile: string): number {
  try {
    const fullPath = path.join(PACKAGE_DIR, dataFile)
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
    return Array.isArray(data) ? data.length : 0
  } catch {
    return 0
  }
}

function parseSchemaFile(schemaFile: string): SchemaInfo | null {
  try {
    const fullPath = path.join(PACKAGE_DIR, 'schemas', schemaFile)
    const schema = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))

    const id = schemaFile.replace('.schema.json', '')
    const dataFile = `data/${id}.json`

    const info: SchemaInfo = {
      id,
      title: schema.title || id,
      description: schema.description || '',
      dataFile,
      schemaFile: `schemas/${schemaFile}`,
      itemCount: getItemCount(dataFile),
    }

    // Add $comment if present
    if (schema.$comment) {
      info.comment = schema.$comment
    }

    return info
  } catch (error) {
    console.error(`Error parsing ${schemaFile}:`, error)
    return null
  }
}

/**
 * No `version` field: the package has no release stream (ADR-040), the
 * repository's release is the deployed commit (ADR-041), and nothing reads one.
 * No `generated` timestamp either: the file is gitignored build output that
 * `ModelFactory` bundles, so the same inputs must give the same bytes.
 */
type SchemaIndex = {
  $schema: string
  title: string
  description: string
  schemas: Array<{
    id: string
    title: string
    description: string
    comment?: string
    dataFile: string
    schemaFile: string
    itemCount: number
    meta?: boolean
  }>
}

/** Ids whose catalog entry is `meta` — the registry's `meta` flag. */
const META_IDS = new Set(registry.filter((e) => e.meta).map((e) => e.id))

function generateSchemaIndex(schemas: SchemaInfo[]): void {
  const outputPath = path.join(PACKAGE_DIR, 'schemas', 'index.json')

  const index: SchemaIndex = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Salvage Union Data Schema Catalog',
    description: 'Catalog of all available schemas in the salvageunion-data repository',
    schemas: schemas.map((s) => {
      const entry: SchemaIndex['schemas'][0] = {
        id: s.id,
        title: s.title,
        description: s.description,
        dataFile: s.dataFile,
        schemaFile: s.schemaFile,
        itemCount: s.itemCount,
      }
      // Only include comment if it exists
      if (s.comment) {
        entry.comment = s.comment
      }
      if (META_IDS.has(s.id)) {
        entry.meta = true
      }
      return entry
    }),
  }

  // Publish the file as ONE atomic step: write the full contents to a temp
  // file in the SAME directory (so `rename` stays within one filesystem, where
  // POSIX guarantees it is atomic) and rename it over the target. A reader
  // therefore sees either the old index or the new one — never a half-written
  // file. Unlink the temp file if the rename itself fails.
  const tempPath = `${outputPath}.${process.pid}.tmp`
  try {
    // Biome, as the schema files are: `biome ci .` reads this path too.
    fs.writeFileSync(tempPath, formatWithBiome(JSON.stringify(index), outputPath))
    fs.renameSync(tempPath, outputPath)
  } catch (error) {
    fs.rmSync(tempPath, { force: true })
    throw error
  }
  console.log(`✅ Generated schemas/index.json (${schemas.length} schemas)`)
}

// Main function
function main() {
  console.log('📝 Generating documentation from schemas...\n')

  const schemaFiles = getSchemaFiles()
  const schemas = schemaFiles.map(parseSchemaFile).filter((s): s is SchemaInfo => s !== null)

  console.log(`Found ${schemas.length} schema files\n`)

  // Generate schema index
  generateSchemaIndex(schemas)

  console.log('\n✨ Documentation generation complete!')
}

main()
