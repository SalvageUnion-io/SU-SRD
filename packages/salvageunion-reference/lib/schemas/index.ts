/**
 * Schema index - exports all Zod schemas and inferred TypeScript types
 */

import { z } from 'zod'

// Re-export all schemas
export * from './enums.js'
export * from './common.js'
export * from './objects.js'
export * from './entities.js'

// Import schemas for type inference
import {
  SourceSchema,
  ContentTypeSchema,
  RangeItemSchema,
  RangeSchema,
  ActionTypeSchema,
  DamageTypeSchema,
  ClassTypeSchema,
  TreeSchema,
  SchemaNameSchema,
} from './enums.js'

import {
  IdSchema,
  NameSchema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  AssetUrlSchema,
  ActivationCostSchema,
  TechLevelSchema,
  SalvageValueSchema,
  HitPointsSchema,
  StructurePointsSchema,
} from './common.js'

import {
  TraitSchema,
  StatsSchema,
  ChassisStatsSchema,
  EquipmentStatsSchema,
  CombatEntitySchema,
  MechanicalEntitySchema,
  DataValueSchema,
  ContentBlockSchema,
  ContentSchema,
  TableContentSchema,
  TableSchema,
  PatternSystemModuleSchema,
  SystemModuleSchema,
  ChoiceSchema,
  ChoicesSchema,
  NpcSchema,
  PatternSchema,
  DamageSchema,
  ActionSchema,
  BaseEntitySchema,
  BonusPerTechLevelSchema,
  AdvancedClassSchema,
  FormationMechSchema,
  GrantSchema,
  CrawlerMutationSchema,
  SchemaNameWithActionsSchema,
  GuideStepSchema,
} from './objects.js'

import {
  AbilitySchema,
  AbilityTreeRequirementSchema,
  MetaActionSchema,
  BioTitanSchema,
  ChassisSchema,
  ClassSchema,
  CrawlerBaySchema,
  CrawlerTechLevelSchema,
  CrawlerSchema,
  CreatureSchema,
  DistanceSchema,
  DroneSchema,
  EquipmentSchema,
  FactionSchema,
  KeywordSchema,
  MeldSchema,
  ModuleSchema,
  NPCSchema,
  RollTableSchema,
  SquadSchema,
  SystemSchema,
  TraitEntitySchema,
  VehicleSchema,
  GuideSchema,
  SourceEntitySchema,
  TechLevelEntitySchema,
  CatalogCategorySchema,
} from './entities.js'

// Export inferred types with SURef prefix for backward compatibility

// Enum types
export type SURefEnumSource = z.infer<typeof SourceSchema>
export type SURefEnumContentType = z.infer<typeof ContentTypeSchema>
export type SURefEnumRangeItem = z.infer<typeof RangeItemSchema>
export type SURefEnumRange = z.infer<typeof RangeSchema>
export type SURefEnumActionType = z.infer<typeof ActionTypeSchema>
export type SURefEnumDamageType = z.infer<typeof DamageTypeSchema>
export type SURefEnumClassType = z.infer<typeof ClassTypeSchema>
export type SURefEnumTree = z.infer<typeof TreeSchema>
export type SURefEnumSchemaName = z.infer<typeof SchemaNameSchema>

// Common types
export type SURefCommonId = z.infer<typeof IdSchema>
export type SURefCommonName = z.infer<typeof NameSchema>
export type SURefCommonNonNegativeInteger = z.infer<typeof NonNegativeIntegerSchema>
export type SURefCommonPositiveInteger = z.infer<typeof PositiveIntegerSchema>
export type SURefCommonAssetUrl = z.infer<typeof AssetUrlSchema>
export type SURefCommonActivationCost = z.infer<typeof ActivationCostSchema>
export type SURefCommonTechLevel = z.infer<typeof TechLevelSchema>
export type SURefCommonSalvageValue = z.infer<typeof SalvageValueSchema>
export type SURefCommonHitPoints = z.infer<typeof HitPointsSchema>
export type SURefCommonStructurePoints = z.infer<typeof StructurePointsSchema>

// Object types
export type SURefObjectTrait = z.infer<typeof TraitSchema>
export type SURefObjectStats = z.infer<typeof StatsSchema>
export type SURefObjectChassisStats = z.infer<typeof ChassisStatsSchema>
export type SURefObjectEquipmentStats = z.infer<typeof EquipmentStatsSchema>
export type SURefObjectCombatEntity = z.infer<typeof CombatEntitySchema>
export type SURefObjectMechanicalEntity = z.infer<typeof MechanicalEntitySchema>
export type SURefObjectDataValue = z.infer<typeof DataValueSchema>
export type SURefObjectContentBlock = z.infer<typeof ContentBlockSchema>
export type SURefObjectContent = z.infer<typeof ContentSchema>
export type SURefObjectTableContent = z.infer<typeof TableContentSchema>
export type SURefObjectTable = z.infer<typeof TableSchema>
export type SURefObjectPatternSystemModule = z.infer<typeof PatternSystemModuleSchema>
export type SURefObjectSystemModule = z.infer<typeof SystemModuleSchema>
export type SURefObjectChoice = z.infer<typeof ChoiceSchema>
export type SURefObjectChoices = z.infer<typeof ChoicesSchema>
export type SURefObjectNpc = z.infer<typeof NpcSchema>
export type SURefObjectPattern = z.infer<typeof PatternSchema>
export type SURefObjectDamage = z.infer<typeof DamageSchema>
export type SURefObjectAction = z.infer<typeof ActionSchema>
export type SURefObjectBaseEntity = z.infer<typeof BaseEntitySchema>
export type SURefObjectBonusPerTechLevel = z.infer<typeof BonusPerTechLevelSchema>
export type SURefObjectAdvancedClass = z.infer<typeof AdvancedClassSchema>
export type SURefObjectFormationMech = z.infer<typeof FormationMechSchema>
export type SURefObjectGrant = z.infer<typeof GrantSchema>
export type SURefObjectCrawlerMutation = z.infer<typeof CrawlerMutationSchema>
export type SURefObjectSchemaName = z.infer<typeof SchemaNameWithActionsSchema>
export type SURefObjectGuideStep = z.infer<typeof GuideStepSchema>
export type SURefObjectTraits = SURefObjectTrait[]
export type SURefObjectSystems = string[]
export type SURefObjectModules = string[]
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
  | SURefBioTitan
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
  | SURefTrait
  | SURefVehicle

export type SURefMetaEntity =
  | SURefAbility
  | SURefBioTitan
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
  | SURefModule
  | SURefNPC
  | SURefRollTable
  | SURefSquad
  | SURefSystem
  | SURefTrait
  | SURefVehicle
