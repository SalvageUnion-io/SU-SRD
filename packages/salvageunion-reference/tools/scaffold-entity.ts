#!/usr/bin/env bun
/**
 * scaffold-entity — checklist generator for adding a new entity/schema type.
 *
 * Adding a schema is a well-known footgun: it requires parallel hand-edits in
 * ~7 places kept honest only by lib/registryConsistency.test.ts. This script
 * does NOT edit those files (a codemod across generated + hand-written +
 * union-type sites is risky and easy to get subtly wrong). Instead it derives
 * every insertion point from the naming rules the registry actually uses and
 * prints an ordered, ready-to-paste checklist — the safe alternative.
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

import { toPascalCase, zodSchemaMap } from '../lib/ModelFactory.js'

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

const existingIds = new Set(Object.keys(zodSchemaMap))
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

const modelProp = toPascalCase(id) // e.g. "power-cores" -> "PowerCores" (matches SchemaToModelMap)
const singular = (singularArg ?? titleCaseFromId(id)).trim()
const plural = (pluralArg ?? titleCaseFromId(id)).trim()
const typeName = `SURef${pascalWords(singular)}` // suggested type name (you own the final name)
const zodVar = `${pascalWords(singular)}Schema` // suggested Zod schema variable
const lazyVar = `lazy${modelProp}`
const dataFile = `data/${id}.json`
const schemaFile = `schemas/${id}.schema.json`
const registryEntry = nonEntity
  ? `{ model: '${modelProp}', display: '${singular}', entity: false as const }`
  : `{ model: '${modelProp}', display: '${singular}' }`

// ─── print the checklist ─────────────────────────────────────────────────────

const rule = '='.repeat(78)
const line = (s = '') => console.log(s)

line(rule)
line(`Scaffold checklist — new schema "${id}"`)
line(rule)
line()
line('Derived names:')
line(`  schema id .......... ${id}`)
line(`  model property ..... SalvageUnionReference.${modelProp}`)
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
line('Edit these sites IN ORDER. lib/registryConsistency.test.ts fails loudly if')
line('any map drifts, so run the tests at the end to confirm coverage.')
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
line()

line('2. Data file — create ' + dataFile)
line('     []   (start with an empty JSON array, then add entries)')
line()

line('3. lib/ModelFactory.ts — add "' + id + '" to all four registries:')
line(`     - import { ${zodVar} } from './schemas/index.js'`)
line(`     - dataLoaders['${id}']       -> import('../${dataFile}', ...)`)
line(`     - jsonSchemaLoaders['${id}'] -> import('../${schemaFile}', ...)`)
line(`     - zodSchemaMap['${id}']      -> ${zodVar}`)
line(`     - schemaDisplayNames['${id}'] -> { singular: '${singular}', plural: '${plural}' }`)
line()

line('4. lib/index.ts — five edits:')
line(`     a. import type { ${typeName} } from './types/index.js'`)
line(`     b. const ${lazyVar} = new LazyModel<SchemaToEntityMap['${id}']>(`)
line(`          '${id}', '${modelProp}', '${singular}')`)
line(`     c. SchemaToEntityMap:  '${id}': ${typeName}`)
line(`     d. lazyModelMap:       '${id}': ${lazyVar},`)
line(`     e. SCHEMA_REGISTRY:    '${id}': ${registryEntry},`)
line(`     f. static accessor:`)
line(`          static ${modelProp}: ModelWithMetadata<SchemaToEntityMap['${id}']> = ${lazyVar}`)
line()

line('5. schemas/index.json — add a catalog entry under "schemas":')
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

line('6. tools/generateJsonSchemas.ts — NOTHING to do; it imports zodSchemaMap,')
line('   so step 3 covers it. Then generate the JSON schema file:')
line('     bun run build:package')
line()

line('7. Verify:')
line('     bun --filter salvageunion-reference typecheck')
line('     bun --filter salvageunion-reference test    # registryConsistency guard')
line('     bun run validate:all')
line()
line(rule)
line('Done. If registryConsistency.test.ts still fails, a map above was missed.')
line(rule)
