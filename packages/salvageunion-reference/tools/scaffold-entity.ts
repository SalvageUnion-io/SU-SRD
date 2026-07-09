#!/usr/bin/env bun
/**
 * scaffold-entity — checklist generator for adding a new entity/schema type.
 *
 * Registering a schema is now ONE manifest entry (lib/schemas/registry.ts) —
 * tools/generateRegistry.ts generates dataLoaders / jsonSchemaLoaders /
 * zodSchemaMap / schemaDisplayNames / LazyModel instances / lazyModelMap /
 * SchemaToEntityMap / SCHEMA_REGISTRY / the static accessors from it. What's
 * left genuinely needs human authorship — the Zod schema itself, deciding
 * which type unions it belongs in, and the schemas/index.json catalog prose —
 * so this script still doesn't edit files (getting a codemod right across
 * hand-written + union-type sites is risky), it just prints an ordered,
 * ready-to-paste checklist for those remaining manual steps.
 *
 * Usage:
 *   bun run scaffold:entity <schema-id> [Singular] [Plural] [--non-entity]
 *
 *   <schema-id>   kebab-case data-file id, e.g. "widgets" or "power-cores"
 *   [Singular]    display name, e.g. "Widget"        (default: derived from id)
 *   [Plural]      display name, e.g. "Widgets"       (default: derived from id)
 *   --non-entity  mark as a non-entity metadata schema (entity: false), like
 *                 catalog-categories — excluded from EntitySchemaNames and the
 *                 SURefEntity union.
 *
 * Examples:
 *   bun run scaffold:entity widgets Widget Widgets
 *   bun run scaffold:entity power-cores "Power Core" "Power Cores"
 *   bun run scaffold:entity biomes Biome Biomes --non-entity
 */

import { toPascalCase } from '../lib/naming.js'
import { registry } from '../lib/schemas/registry.js'

// ─── arg parsing ─────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2)
const nonEntity = rawArgs.includes('--non-entity')
const positionals = rawArgs.filter((a) => !a.startsWith('--'))
const [idArg, singularArg, pluralArg] = positionals

if (!idArg) {
  console.error('Error: missing <schema-id>.\n')
  console.error('Usage: bun run scaffold:entity <schema-id> [Singular] [Plural] [--non-entity]')
  console.error('Example: bun run scaffold:entity widgets Widget Widgets')
  process.exit(1)
}

const id = idArg.trim()
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id)) {
  console.error(`Error: schema id "${id}" must be kebab-case (e.g. "power-cores").`)
  process.exit(1)
}

// ─── collision check against the live registry ───────────────────────────────

const existingIds = new Set(registry.map((entry) => entry.id))
if (existingIds.has(id)) {
  console.error(`Error: schema id "${id}" already exists in the registry. Pick a new id.`)
  process.exit(1)
}

// ─── derive names ────────────────────────────────────────────────────────────

/** Title Case a kebab id: "power-cores" -> "Power Cores" */
function titleCaseFromId(kebab: string): string {
  return kebab
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** PascalCase, hyphen/space free: "Power Core" -> "PowerCore" */
function pascalWords(s: string): string {
  return s
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
}

const modelProp = toPascalCase(id) // e.g. "power-cores" -> "PowerCores"
const singular = (singularArg ?? titleCaseFromId(id)).trim()
const plural = (pluralArg ?? titleCaseFromId(id)).trim()
const typeName = `SURef${pascalWords(singular)}` // suggested type name (you own the final name)
const zodVar = `${pascalWords(singular)}Schema` // suggested Zod schema variable
const dataFile = `data/${id}.json`
const schemaFile = `schemas/${id}.schema.json`
const manifestEntry = nonEntity
  ? `{ id: '${id}', typeName: '${typeName}', zodExportName: '${zodVar}', singular: '${singular}', plural: '${plural}', entity: false }`
  : `{ id: '${id}', typeName: '${typeName}', zodExportName: '${zodVar}', singular: '${singular}', plural: '${plural}' }`

// ─── print the checklist ─────────────────────────────────────────────────────

const rule = '='.repeat(78)
const line = (s = '') => console.log(s)

line(rule)
line(`Scaffold checklist — new schema "${id}"`)
line(rule)
line()
line('Derived names:')
line(`  schema id .......... ${id}`)
line(`  model property ..... SalvageUnionReference.${modelProp}  (derived from id, not stored)`)
line(`  display (singular) . ${singular}`)
line(`  display (plural) ... ${plural}`)
line(`  suggested type ..... ${typeName}   (you name it in the Zod schema)`)
line(`  suggested Zod var .. ${zodVar}`)
line(`  data file .......... ${dataFile}`)
line(`  json schema ........ ${schemaFile}  (generated — do not hand-edit)`)
line(`  kind ............... ${nonEntity ? 'non-entity metadata schema' : 'entity schema'}`)
line()
line(`Registry currently holds ${existingIds.size} schemas; this makes ${existingIds.size + 1}.`)
line()
line('Only 3 hand-authored steps now — everything else (dataLoaders,')
line('jsonSchemaLoaders, zodSchemaMap, schemaDisplayNames, LazyModel instances,')
line('lazyModelMap, SchemaToEntityMap, SCHEMA_REGISTRY, and the')
line('SalvageUnionReference static accessor) is generated from the manifest entry')
line('in step 3 by tools/generateRegistry.ts. lib/registryConsistency.test.ts')
line('still independently checks the generated output — run it at the end.')
line()

line('1. Zod schema + inferred type — lib/schemas/entities.ts')
line(`     export const ${zodVar} = BaseEntitySchema.extend({ /* fields */ })`)
line('   Then lib/schemas/index.ts:')
line(`     - import ${zodVar} into the schema import block`)
line(`     - export type ${typeName} = z.infer<typeof ${zodVar}>`)
if (!nonEntity) {
  line(`     - add "| ${typeName}" to the SURefEntity AND SURefMetaEntity unions`)
  line('       in BOTH of these files (the unions are declared twice — the')
  line('       lib/types/index.ts copy shadows and is the package-public one):')
  line('         - lib/schemas/index.ts')
  line('         - lib/types/index.ts')
} else {
  line(`     - do NOT add ${typeName} to the SURefEntity / SURefMetaEntity unions`)
  line('       (non-entity schema) in lib/schemas/index.ts or lib/types/index.ts')
}
line('   These need human judgment (which unions a schema belongs in), so the')
line('   generator deliberately does not touch them.')
line()

line('2. Data file — create ' + dataFile)
line('     []   (start with an empty JSON array, then add entries)')
line('   And a catalog entry in schemas/index.json under "schemas" (also')
line('   hand-authored — prose description, required fields):')
line('     {')
line(`       "id": "${id}",`)
line(`       "title": "${id}",`)
line('       "description": "<one-line description>",')
line(`       "dataFile": "${dataFile}",`)
line(`       "schemaFile": "${schemaFile}",`)
line('       "itemCount": 0,')
line('       "requiredFields": ["id", "name"],')
line(`       "displayName": "${plural}"`)
line('     }')
line()

line('3. lib/schemas/registry.ts — add ONE entry to the `registry` array:')
line(`     ${manifestEntry},`)
line()
line('   Then regenerate everything derived from it:')
line('     bun run build:package')
line()

line('4. Verify:')
line('     bun --filter salvageunion-reference typecheck')
line('     bun --filter salvageunion-reference test    # registryConsistency guard')
line('     bun run validate:all')
line()
line(rule)
line('Done. If registryConsistency.test.ts still fails, the manifest entry was')
line('missed or mistyped — check lib/schemas/registry.ts.')
line(rule)
