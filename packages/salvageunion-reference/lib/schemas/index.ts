/**
 * Schema index - exports all Zod schemas and inferred TypeScript types.
 *
 * The per-entity Ref* aliases and the RefEntity / RefMetaEntity unions
 * are GENERATED from lib/schemas/registry.ts (tools/generateRegistry.ts) into
 * lib/generated/entityTypes.generated.ts and re-exported here, so union
 * membership cannot drift from the registry. Only the object-level aliases
 * (RefObject*), which have no registry entry, are written below.
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

// Inferred types, exported under the Ref* prefix used across the monorepo.

// Enum types
export type RefEnumSchemaName = z.infer<typeof SchemaNameSchema>

// Object types
export type RefObjectTrait = z.infer<typeof TraitSchema>
export type RefObjectDataValue = z.infer<typeof DataValueSchema>
export type RefObjectContentBlock = z.infer<typeof ContentBlockSchema>
export type RefObjectTableContent = z.infer<typeof TableContentSchema>
export type RefObjectTable = z.infer<typeof TableSchema>
export type RefObjectSystemModule = z.infer<typeof SystemModuleSchema>
export type RefObjectChoice = z.infer<typeof ChoiceSchema>
export type RefObjectPattern = z.infer<typeof PatternSchema>
export type RefObjectBioTitanPattern = z.infer<typeof BioTitanPatternSchema>
/** A pattern of either host: a mech pattern (on a chassis) or a Bio-Titan's. */
export type RefObjectAnyPattern = RefObjectPattern | RefObjectBioTitanPattern
export type RefObjectDamage = z.infer<typeof DamageSchema>
export type RefObjectBonusPerTechLevel = z.infer<typeof StatsSchema>
export type RefObjectAdvancedClass = z.infer<typeof AdvancedClassSchema>
export type RefObjectGrant = z.infer<typeof GrantSchema>
export type RefObjectGuideStep = z.infer<typeof GuideStepSchema>
