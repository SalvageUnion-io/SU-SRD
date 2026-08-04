/**
 * Drift guard for the six `z.lazy()` schemas.
 *
 * A hand-written `z.ZodType<{…}>` annotation on a `z.lazy()` schema is a SILENT
 * type lie: TypeScript accepts an annotation that is narrower than the object
 * the getter actually builds, so a key present in the Zod shape — parsed at
 * runtime, emitted into `schemas/*.schema.json`, present in the data — is
 * missing from `z.infer` for every consumer in the monorepo. Nothing fails; the
 * field just does not exist as far as the compiler is concerned.
 *
 * All six annotations have been removed (the types are inferred now). These
 * tests keep them removed, and keep the inferred key set honest:
 *
 *   1. No `z.ZodType<…> = z.lazy(…)` pair may reappear in `lib/schemas/`.
 *   2. For each schema, ONE committed key list is checked against BOTH the live
 *      Zod shape (runtime) and `keyof z.infer<…>` (compile time). A key that
 *      exists in one and not the other cannot satisfy both, which is exactly
 *      the divergence an annotation used to hide.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

import type { z } from '../zod.js'
import {
  ActionSchema,
  ChoiceSchema,
  ContentBlockSchema,
  GuideStepSchema,
  NpcSchema,
  PatternSchema,
} from './objects.js'

// --- 1. the annotation may not come back -----------------------------------

describe('no hand-written z.ZodType annotation on a z.lazy() schema', () => {
  it('finds none anywhere in lib/schemas/', () => {
    const dir = join(import.meta.dir)
    const offenders: string[] = []
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue
      const source = readFileSync(join(dir, file), 'utf8')
      // `z.ZodType<…> = z.lazy(` possibly spanning lines.
      if (/:\s*z\.ZodType<[\s\S]*?>\s*=\s*z\s*\n?\s*\.?\s*lazy\(/.test(source)) {
        offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })
})

// --- 2. runtime shape and inferred type agree, against ONE committed list ---

/**
 * Compile-time assertion that `keyof z.infer<S>` is exactly `K`. Both
 * directions are checked, so neither a missing nor an extra inferred key
 * passes. `K` comes from the same `as const` array the runtime check uses.
 */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
function expectKeys<S extends z.ZodType, K extends PropertyKey>(
  _schema: S,
  _keys: readonly K[] & (Exact<keyof z.infer<S>, K> extends true ? unknown : never)
): void {}

/** The live object shape behind a `z.lazy()` schema. */
function lazyShapeKeys(schema: unknown): string[] {
  const getter = (schema as { def: { getter: () => { def: { shape: object } } } }).def.getter
  return Object.keys(getter().def.shape)
}

const CONTENT_BLOCK_KEYS = ['type', 'value', 'label', 'level', 'lead', 'choiceId', 'items'] as const

const CHOICE_KEYS = [
  'id',
  'name',
  'choiceType',
  'content',
  'rollTable',
  'schemaEntities',
  'schema',
  'customSystemOptions',
  'multiSelect',
  'choiceOptions',
  'constraints',
  'source',
  'cardinality',
  'lifetime',
] as const

const NPC_KEYS = ['position', 'content', 'hitPoints', 'choices'] as const

const PATTERN_KEYS = [
  'name',
  'content',
  'legalStarting',
  'hidden',
  'source',
  'page',
  'booklet',
  'additionalSources',
  'systems',
  'modules',
  'drones',
] as const

const ACTION_KEYS = [
  'id',
  'name',
  'content',
  'structurePoints',
  'energyPoints',
  'heatCapacity',
  'systemSlots',
  'moduleSlots',
  'cargoCapacity',
  'techLevel',
  'salvageValue',
  'displayName',
  'activationCost',
  'range',
  'actionType',
  'traits',
  'damage',
  'choices',
  'table',
  'tableName',
  'hidden',
  'activationCurrency',
  'source',
  'page',
  'actionSource',
  'drone',
] as const

const GUIDE_STEP_KEYS = [
  'id',
  'name',
  'stepType',
  'section',
  'content',
  'schema',
  'schemaEntities',
  'schemaField',
  'rollTable',
  'choiceOptions',
  'filters',
  'constraints',
  'guideRef',
  'optional',
  'paperOnly',
  'entityLayout',
] as const

// Compile-time half. A dropped optional key makes `Exact` false, and the call
// stops type-checking — which is the failure the annotations used to swallow.
expectKeys(ContentBlockSchema, CONTENT_BLOCK_KEYS)
expectKeys(ChoiceSchema, CHOICE_KEYS)
expectKeys(NpcSchema, NPC_KEYS)
expectKeys(PatternSchema, PATTERN_KEYS)
expectKeys(ActionSchema, ACTION_KEYS)
expectKeys(GuideStepSchema, GUIDE_STEP_KEYS)

describe('lazy schema runtime shape matches the committed key list', () => {
  const cases: ReadonlyArray<readonly [string, unknown, readonly string[]]> = [
    ['ContentBlockSchema', ContentBlockSchema, CONTENT_BLOCK_KEYS],
    ['ChoiceSchema', ChoiceSchema, CHOICE_KEYS],
    ['NpcSchema', NpcSchema, NPC_KEYS],
    ['PatternSchema', PatternSchema, PATTERN_KEYS],
    ['ActionSchema', ActionSchema, ACTION_KEYS],
    ['GuideStepSchema', GuideStepSchema, GUIDE_STEP_KEYS],
  ]

  for (const [name, schema, keys] of cases) {
    it(`${name} declares exactly its committed keys`, () => {
      expect(lazyShapeKeys(schema).sort()).toEqual([...keys].sort())
    })
  }
})
