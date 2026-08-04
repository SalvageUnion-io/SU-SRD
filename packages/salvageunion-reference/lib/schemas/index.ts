/**
 * Schema index - exports all Zod schemas and inferred TypeScript types
 */

import type { z } from '../zod.js'

export * from './common.js'
export * from './entities.js'
// Re-export all schemas
export * from './enums.js'
export * from './objects.js'

import type {
  AbilitySchema,
  AbilityTreeRequirementSchema,
  BioTitanSchema,
  CatalogCategorySchema,
  ChassisSchema,
  ClassSchema,
  CrawlerBaySchema,
  CrawlerSchema,
  CrawlerTechLevelSchema,
  CreatureSchema,
  DistanceSchema,
  DroneSchema,
  EquipmentSchema,
  FactionSchema,
  GuideSchema,
  KeywordSchema,
  MeldSchema,
  MetaActionSchema,
  ModuleSchema,
  NPCSchema,
  RollTableSchema,
  SourceEntitySchema,
  SquadSchema,
  SystemSchema,
  TechLevelEntitySchema,
  TraitEntitySchema,
  VehicleSchema,
} from './entities.js'
// Import schemas for type inference
import type { SchemaNameSchema } from './enums.js'
import type {
  AdvancedClassSchema,
  ChoiceSchema,
  ContentBlockSchema,
  ContentSchema,
  CrawlerMutationSchema,
  DamageSchema,
  DataValueSchema,
  FormationMechSchema,
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
export type SURefObjectFormationMech = z.infer<typeof FormationMechSchema>
export type SURefObjectGrant = z.infer<typeof GrantSchema>
export type SURefObjectCrawlerMutation = z.infer<typeof CrawlerMutationSchema>
export type SURefObjectGuideStep = z.infer<typeof GuideStepSchema>
export type SURefObjectActionOptions = Array<{ label: string; value: string }>

// Entity types
export type SURefAbility = z.infer<typeof AbilitySchema>
export type SURefMetaAbilityTreeRequirement = z.infer<typeof AbilityTreeRequirementSchema>
export type SURefMetaAction = z.infer<typeof MetaActionSchema>
export type SURefBioTitan = z.infer<typeof BioTitanSchema>
export type SURefChassis = z.infer<typeof ChassisSchema>
export type SURefClass = z.infer<typeof ClassSchema>
export type SURefCrawlerBay = z.infer<typeof CrawlerBaySchema>
export type SURefMetaCrawlerTechLevel = z.infer<typeof CrawlerTechLevelSchema>
export type SURefCrawler = z.infer<typeof CrawlerSchema>
export type SURefCreature = z.infer<typeof CreatureSchema>
export type SURefDistance = z.infer<typeof DistanceSchema>
export type SURefDrone = z.infer<typeof DroneSchema>
export type SURefEquipment = z.infer<typeof EquipmentSchema>
export type SURefFaction = z.infer<typeof FactionSchema>
export type SURefKeyword = z.infer<typeof KeywordSchema>
export type SURefMeld = z.infer<typeof MeldSchema>
export type SURefModule = z.infer<typeof ModuleSchema>
export type SURefNPC = z.infer<typeof NPCSchema>
export type SURefRollTable = z.infer<typeof RollTableSchema>
export type SURefSquad = z.infer<typeof SquadSchema>
export type SURefSystem = z.infer<typeof SystemSchema>
export type SURefTrait = z.infer<typeof TraitEntitySchema>
export type SURefVehicle = z.infer<typeof VehicleSchema>
export type SURefGuide = z.infer<typeof GuideSchema>
export type SURefSource = z.infer<typeof SourceEntitySchema>
export type SURefTechLevel = z.infer<typeof TechLevelEntitySchema>
export type SURefCatalogCategory = z.infer<typeof CatalogCategorySchema>

// Union types
export type SURefEntity =
  | SURefAbility
  | SURefChassis
  | SURefClass
  | SURefCrawler
  | SURefCrawlerBay
  | SURefCreature
  | SURefDistance
  | SURefDrone
  | SURefEquipment
  | SURefFaction
  | SURefGuide
  | SURefKeyword
  | SURefMeld
  | SURefModule
  | SURefNPC
  | SURefRollTable
  | SURefSource
  | SURefSquad
  | SURefSystem
  | SURefTechLevel
  | SURefBioTitan
  | SURefTrait
  | SURefVehicle

export type SURefMetaEntity =
  | SURefAbility
  | SURefChassis
  | SURefClass
  | SURefCrawler
  | SURefCrawlerBay
  | SURefCreature
  | SURefDistance
  | SURefDrone
  | SURefEquipment
  | SURefFaction
  | SURefKeyword
  | SURefMeld
  | SURefMetaAbilityTreeRequirement
  | SURefMetaAction
  | SURefMetaCrawlerTechLevel
  | SURefGuide
  | SURefSource
  | SURefTechLevel
  | SURefBioTitan
  | SURefModule
  | SURefNPC
  | SURefRollTable
  | SURefSquad
  | SURefSystem
  | SURefTrait
  | SURefVehicle
