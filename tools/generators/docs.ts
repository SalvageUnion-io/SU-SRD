#!/usr/bin/env bun

import { join } from 'path'

interface SchemaInfo {
  id: string
  title: string
  description: string
  comment?: string
  dataFile: string
  schemaFile: string
  itemCount: number
  requiredFields: string[]
  displayName: string
}

// Get version from package.json
async function getPackageVersion(): Promise<string> {
  try {
    const packageJsonPath = join(import.meta.dir, '..', '..', 'package.json')
    const file = Bun.file(packageJsonPath)
    const packageJson = (await file.json()) as { version?: string }
    return packageJson.version || '1.0.0'
  } catch {
    console.warn('⚠️  Could not read package.json version, using default')
    return '1.0.0'
  }
}

// Get all schema files
async function getSchemaFiles(): Promise<string[]> {
  const schemasDir = join(import.meta.dir, '..', '..', 'src', 'reference', 'schemas')
  const { readdir } = await import('fs/promises')
  const files = await readdir(schemasDir)
  return files.filter((file) => file.endsWith('.schema.json') && file !== 'index.json').sort()
}

// Get item count from data file
async function getItemCount(dataFile: string): Promise<number> {
  try {
    const fullPath = join(import.meta.dir, '..', '..', dataFile)
    const file = Bun.file(fullPath)
    const data = (await file.json()) as unknown[]
    return Array.isArray(data) ? data.length : 0
  } catch {
    return 0
  }
}

interface JSONSchema {
  items?: {
    required?: string[]
    oneOf?: Array<{ required?: string[] }>
  }
  required?: string[]
  [key: string]: unknown
}

// Extract required fields from schema
function getRequiredFields(schema: JSONSchema, schemaId: string): string[] {
  // Try items.required first (for array schemas)
  if (schema.items?.required) {
    return schema.items.required
  }

  // Handle oneOf schemas (like classes)
  if (schema.items?.oneOf && Array.isArray(schema.items.oneOf)) {
    // Get required fields from first oneOf option
    if (schema.items.oneOf[0]?.required) {
      return schema.items.oneOf[0].required
    }
  }

  // Try top-level required
  if (schema.required) {
    return schema.required
  }

  // Handle schemas that use shared definitions
  // These inherit required fields from the shared schema
  const sharedDefinitionSchemas: Record<string, string[]> = {
    keywords: ['name', 'source', 'page'],
    traits: ['name', 'source', 'page'],
    modules: ['name', 'page'],
    systems: ['name', 'page'],
  }

  if (sharedDefinitionSchemas[schemaId]) {
    return sharedDefinitionSchemas[schemaId]
  }

  return []
}

async function parseSchemaFile(schemaFile: string): Promise<SchemaInfo | null> {
  try {
    const fullPath = join(import.meta.dir, '..', '..', 'src', 'reference', 'schemas', schemaFile)
    const file = Bun.file(fullPath)
    const schema = (await file.json()) as {
      title?: string
      description?: string
      $comment?: string
      items?: { required?: string[]; oneOf?: Array<{ required?: string[] }> }
      required?: string[]
    }

    const id = schemaFile.replace('.schema.json', '')
    const dataFile = `data/${id}.json`

    // Generate display name from schema title or id
    // This will be used to populate the schema index
    let displayName = schema.title || id

    // Convert to proper display format
    if (displayName === 'abilities') displayName = 'Abilities'
    else if (displayName === 'ability-tree-requirements') displayName = 'Ability Tree Requirements'
    else if (displayName === 'bio-titans') displayName = 'Bio-Titans'
    else if (displayName === 'chassis') displayName = 'Chassis'
    else if (displayName === 'classes') displayName = 'Classes'
    else if (displayName === 'crawler-bays') displayName = 'Crawler Bays'
    else if (displayName === 'crawler-tech-levels') displayName = 'Crawler Tech Levels'
    else if (displayName === 'crawlers') displayName = 'Crawlers'
    else if (displayName === 'creatures') displayName = 'Creatures'
    else if (displayName === 'distances') displayName = 'Distances'
    else if (displayName === 'drones') displayName = 'Drones'
    else if (displayName === 'equipment') displayName = 'Equipment'
    else if (displayName === 'keywords') displayName = 'Keywords'
    else if (displayName === 'meld') displayName = 'Meld'
    else if (displayName === 'modules') displayName = 'Modules'
    else if (displayName === 'npcs') displayName = 'NPCs'
    else if (displayName === 'roll-tables') displayName = 'Roll Tables'
    else if (displayName === 'squads') displayName = 'Squads'
    else if (displayName === 'systems') displayName = 'Systems'
    else if (displayName === 'traits') displayName = 'Traits'
    else if (displayName === 'vehicles') displayName = 'Vehicles'

    const info: SchemaInfo = {
      id,
      title: schema.title || id,
      description: schema.description || '',
      dataFile,
      schemaFile: `schemas/${schemaFile}`,
      itemCount: await getItemCount(dataFile),
      requiredFields: getRequiredFields(schema, id),
      displayName,
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

interface SchemaIndex {
  $schema: string
  title: string
  description: string
  version: string
  generated: string
  schemas: Array<{
    id: string
    title: string
    description: string
    comment?: string
    dataFile: string
    schemaFile: string
    itemCount: number
    requiredFields: string[]
    displayName: string
    meta?: boolean
  }>
}

async function generateSchemaIndex(schemas: SchemaInfo[]): Promise<void> {
  const outputPath = join(import.meta.dir, '..', '..', 'src', 'reference', 'schemas', 'index.json')

  // Read existing index if it exists
  let existingIndex: SchemaIndex | null = null
  const outputFile = Bun.file(outputPath)
  if (await outputFile.exists()) {
    existingIndex = (await outputFile.json()) as SchemaIndex
  }

  const newIndex: SchemaIndex = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Salvage Union Data Schema Catalog',
    description: 'Catalog of all available schemas in the salvageunion-data repository',
    version: await getPackageVersion(),
    generated: new Date().toISOString(),
    schemas: schemas.map((s) => {
      // Find existing entry to preserve meta property
      const existingEntry = existingIndex?.schemas.find((e) => e.id === s.id)

      const entry: SchemaIndex['schemas'][0] = {
        id: s.id,
        title: s.title,
        description: s.description,
        dataFile: s.dataFile,
        schemaFile: s.schemaFile,
        itemCount: s.itemCount,
        requiredFields: s.requiredFields,
        displayName: s.displayName,
      }
      // Only include comment if it exists
      if (s.comment) {
        entry.comment = s.comment
      }
      // Preserve meta property from existing entry if it exists
      if (existingEntry?.meta !== undefined) {
        entry.meta = existingEntry.meta
      }
      return entry
    }),
  }

  // Check if only the generated field would change
  if (existingIndex) {
    const existingWithoutGenerated = { ...existingIndex, generated: undefined }
    const newWithoutGenerated = { ...newIndex, generated: undefined }

    if (JSON.stringify(existingWithoutGenerated) === JSON.stringify(newWithoutGenerated)) {
      console.log(`⏭️  Skipped schemas/index.json (only generated timestamp would change)`)
      return
    }
  }

  await Bun.write(outputPath, JSON.stringify(newIndex, null, 2) + '\n')
  console.log(`✅ Generated schemas/index.json (${schemas.length} schemas)`)
}

// Generate VSCode settings
async function generateVSCodeSettings(schemas: SchemaInfo[]): Promise<void> {
  const settings = {
    'json.schemas': schemas.map((s) => ({
      fileMatch: [s.dataFile],
      url: `./${s.schemaFile}`,
    })),
    'json.format.enable': true,
    'editor.formatOnSave': true,
    '[json]': {
      'editor.defaultFormatter': 'vscode.json-language-features',
      'editor.tabSize': 2,
    },
  }

  const outputPath = join(import.meta.dir, '..', '..', '.vscode', 'settings.json')
  // Bun.write will create directories automatically
  await Bun.write(outputPath, JSON.stringify(settings, null, 2) + '\n')
  console.log(`✅ Generated .vscode/settings.json (${schemas.length} mappings)`)
}

// Main function
async function main() {
  console.log('📝 Generating documentation from schemas...\n')

  const schemaFiles = await getSchemaFiles()
  const schemas = (await Promise.all(schemaFiles.map(parseSchemaFile))).filter(
    (s): s is SchemaInfo => s !== null
  )

  console.log(`Found ${schemas.length} schema files\n`)

  // Generate schema index
  await generateSchemaIndex(schemas)

  // Generate VSCode settings
  await generateVSCodeSettings(schemas)

  console.log('\n✨ Documentation generation complete!')
  console.log('\n💡 Tip: Use the snippets in .docs-snippets/ to update documentation files')
}

// Export for use as module
export default main

// Run directly if called as script
if (import.meta.main) {
  await main()
}
