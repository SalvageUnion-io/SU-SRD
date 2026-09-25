/**
 * Schema index - exports all Zod schemas and inferred TypeScript types.
 *
 * The per-entity SURef* aliases and the SURefEntity / SURefMetaEntity unions
 * are GENERATED from lib/schemas/registry.ts (tools/generateRegistry.ts) into
 * lib/generated/entityTypes.generated.ts and re-exported here. They used to be
 * hand-written in this file — 27 aliases plus two unions whose membership had
 * to be kept in step with the registry by hand. Only the object-level aliases
 * (SURefObject*), which have no registry entry, are still written below.
 */

import type { z } from '../zod.js'

export type * from '../generated/entityTypes.generated.js'
export * from './common.js'
export * from './entities.js'
// Re-export all schemas
export * from './enums.js'
export * from './objects.js'

// Import schemas for type inference
import type { SchemaNameSchema } from './enums.js'
import type {
  AdvancedClassSchema,
  ChoiceSchema,
  ContentBlockSchema,
  ContentSchema,
  DamageSchema,
  DataValueSchema,
  GrantSchema,
  GuideStepSchema,
  PatternSchema,
  PatternSystemModuleSchema,
  StatsSchema,
  SystemModuleSchema,
  TableContentSchema,
  TableSchema,
  TraitSchema,
} from './objects.js'

// Inferred types, exported under the SURef* prefix used across the monorepo.

// Enum types
export type SURefEnumSchemaName = z.infer<typeof SchemaNameSchema>

// Object types
export type SURefObjectTrait = z.infer<typeof TraitSchema>
export type SURefObjectDataValue = z.infer<typeof DataValueSchema>
export type SURefObjectContentBlock = z.infer<typeof ContentBlockSchema>
export type SURefObjectContent = z.infer<typeof ContentSchema>
export type SURefObjectTableContent = z.infer<typeof TableContentSchema>
export type SURefObjectTable = z.infer<typeof TableSchema>
export type SURefObjectPatternSystemModule = z.infer<typeof PatternSystemModuleSchema>
export type SURefObjectSystemModule = z.infer<typeof SystemModuleSchema>
export type SURefObjectChoice = z.infer<typeof ChoiceSchema>
export type SURefObjectPattern = z.infer<typeof PatternSchema>
export type SURefObjectDamage = z.infer<typeof DamageSchema>
export type SURefObjectBonusPerTechLevel = z.infer<typeof StatsSchema>
export type SURefObjectAdvancedClass = z.infer<typeof AdvancedClassSchema>
export type SURefObjectGrant = z.infer<typeof GrantSchema>
export type SURefObjectGuideStep = z.infer<typeof GuideStepSchema>
