/**
 * Schema index - exports all Zod schemas and inferred TypeScript types.
 *
 * The per-entity SURef* aliases and the SURefEntity / SURefMetaEntity unions
 * are GENERATED from lib/schemas/registry.ts (tools/generateRegistry.ts) into
 * lib/generated/entityTypes.generated.ts and re-exported here, so union
 * membership cannot drift from the registry. Only the object-level aliases
 * (SURefObject*), which have no registry entry, are written below.
 */

import type { z } from '../zod'

export type * from '../generated/entityTypes.generated'
export * from './common'
export * from './entities'
// Re-export all schemas
export * from './enums'
export * from './objects'

// Import schemas for type inference
import type { SchemaNameSchema } from './enums'
import type {
  AdvancedClassSchema,
  BioTitanPatternSchema,
  ChoiceSchema,
  ContentBlockSchema,
  DamageSchema,
  DataValueSchema,
  GrantSchema,
  GuideStepSchema,
  PatternSchema,
  StatsSchema,
  SystemModuleSchema,
  TableContentSchema,
  TableSchema,
  TraitSchema,
} from './objects'

// Inferred types, exported under the SURef* prefix used across the monorepo.

// Enum types
export type SURefEnumSchemaName = z.infer<typeof SchemaNameSchema>

// Object types
export type SURefObjectTrait = z.infer<typeof TraitSchema>
export type SURefObjectDataValue = z.infer<typeof DataValueSchema>
export type SURefObjectContentBlock = z.infer<typeof ContentBlockSchema>
export type SURefObjectTableContent = z.infer<typeof TableContentSchema>
export type SURefObjectTable = z.infer<typeof TableSchema>
export type SURefObjectSystemModule = z.infer<typeof SystemModuleSchema>
export type SURefObjectChoice = z.infer<typeof ChoiceSchema>
export type SURefObjectPattern = z.infer<typeof PatternSchema>
export type SURefObjectBioTitanPattern = z.infer<typeof BioTitanPatternSchema>
/** A pattern of either host: a mech pattern (on a chassis) or a Bio-Titan's. */
export type SURefObjectAnyPattern = SURefObjectPattern | SURefObjectBioTitanPattern
export type SURefObjectDamage = z.infer<typeof DamageSchema>
export type SURefObjectBonusPerTechLevel = z.infer<typeof StatsSchema>
export type SURefObjectAdvancedClass = z.infer<typeof AdvancedClassSchema>
export type SURefObjectGrant = z.infer<typeof GrantSchema>
export type SURefObjectGuideStep = z.infer<typeof GuideStepSchema>
