import fs from 'node:fs'
import path from 'node:path'

/**
 * Every path below is anchored to THIS FILE, not to `process.cwd()`.
 *
 * It used to be cwd-relative, which made the generator's output depend on where
 * it was invoked from. Run as `bun --filter salvageunion-reference docs` the cwd
 * is the package, so `.vscode/settings.json` would have been written to
 * `packages/salvageunion-reference/.vscode/` — a stray directory — while the
 * file the repo actually tracks lives at the ROOT. The two schema outputs were
 * correct by luck, because the package dir happens to be the right base for
 * them. Anchoring removes the luck, and is what let this generator be wired
 * into `build:package` (see that script) without depending on the caller's cwd.
 *
 * `generateSchemaDocs.ts`, its sibling, was already `__dirname`-anchored.
 */
const PACKAGE_DIR = path.join(import.meta.dir, '..')
const REPO_ROOT = path.join(PACKAGE_DIR, '..', '..')

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

function parseSchemaFile(schemaFile: string): SchemaInfo | null {
  try {
    const fullPath = path.join(PACKAGE_DIR, 'schemas', schemaFile)
    const schema = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))

    const id = schemaFile.replace('.schema.json', '')
    const dataFile = `data/${id}.json`

    // Generate display name from schema title or id
    // This will be used to populate the schema index
    let displayName = schema.title || id

    // Convert to proper display format
    if (displayName === 'abilities') displayName = 'Abilities'
    else if (displayName === 'ability-tree-requirements') displayName = 'Ability Tree Requirements'
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
    else if (displayName === 'bio-titans') displayName = 'Bio-Titans'
    else if (displayName === 'traits') displayName = 'Traits'
    else if (displayName === 'vehicles') displayName = 'Vehicles'
    else if (displayName === 'catalog-categories') displayName = 'Catalog Categories'

    const info: SchemaInfo = {
      id,
      title: schema.title || id,
      description: schema.description || '',
      dataFile,
      schemaFile: `schemas/${schemaFile}`,
      itemCount: getItemCount(dataFile),
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

/**
 * NOTE: there is deliberately no `version` field here, and re-adding one will
 * break every release.
 *
 * This catalog used to embed `package.json`'s version. Nothing ever read it —
 * the package is `private: true` (never published to npm), no endpoint serves
 * the catalog, and no caller touches `getSchemaCatalog().version`. What it did
 * do was couple a GENERATED artifact to a version release-please bumps in
 * `package.json` alone: every release PR therefore arrived with a stale
 * `version` here, `check:schemas` regenerated it, saw the mismatch, and failed.
 * Release PRs were unmergeable by construction (#786).
 *
 * release-please's `extra-files` is the usual fix for a file that carries a
 * version, but it does not work here: its JSON updater re-serializes through
 * `JSON.stringify(parsed, replacer, indent)`, which expands every
 * `requiredFields` array onto multiple lines, and `format:check` then rejects
 * the file Biome wants collapsed. That trades a `static-checks` failure for a
 * `quality-checks` one.
 *
 * So the coupling is gone instead of maintained. Two files tracking one version
 * stay in sync only by convention, and this one had no reader to justify it.
 */
interface SchemaIndex {
  $schema: string
  title: string
  description: string
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

function generateSchemaIndex(schemas: SchemaInfo[]): void {
  const outputPath = path.join(PACKAGE_DIR, 'schemas', 'index.json')

  // Read the existing index in a single syscall — `existsSync` followed by
  // `readFileSync` is a check-then-act pair (the file can vanish in between);
  // catching ENOENT off the read itself has no such window.
  let existingIndex: SchemaIndex | null = null
  try {
    existingIndex = JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as SchemaIndex
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const newIndex: SchemaIndex = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Salvage Union Data Schema Catalog',
    description: 'Catalog of all available schemas in the salvageunion-data repository',
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

  // Publish the file as ONE atomic step: write the full contents to a temp
  // file in the SAME directory (so `rename` stays within one filesystem, where
  // POSIX guarantees it is atomic) and rename it over the target. A reader
  // therefore sees either the old index or the new one — never a half-written
  // file, and there is no window between deciding to write and the bytes
  // landing. Unlink the temp file if the rename itself fails.
  const tempPath = `${outputPath}.${process.pid}.tmp`
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(newIndex, null, 2)}\n`)
    fs.renameSync(tempPath, outputPath)
  } catch (error) {
    fs.rmSync(tempPath, { force: true })
    throw error
  }
  console.log(`✅ Generated schemas/index.json (${schemas.length} schemas)`)
}

// Generate VSCode settings
function generateVSCodeSettings(schemas: SchemaInfo[]): void {
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

  const outputPath = path.join(REPO_ROOT, '.vscode', 'settings.json')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(settings, null, 2)}\n`)
  console.log(`✅ Generated .vscode/settings.json (${schemas.length} mappings)`)
}

// Main function
function main() {
  console.log('📝 Generating documentation from schemas...\n')

  const schemaFiles = getSchemaFiles()
  const schemas = schemaFiles.map(parseSchemaFile).filter((s): s is SchemaInfo => s !== null)

  console.log(`Found ${schemas.length} schema files\n`)

  // Generate schema index
  generateSchemaIndex(schemas)

  // Generate VSCode settings
  generateVSCodeSettings(schemas)

  console.log('\n✨ Documentation generation complete!')
  console.log('\n💡 Tip: Use the snippets in .docs-snippets/ to update documentation files')
}

main()
