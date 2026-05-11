/**
 * TypeScript type exports
 *
 * NOTE: All types are now inferred from Zod schemas in lib/schemas/
 * This file re-exports them for backward compatibility
 */

// Re-export all types from the new schemas directory
export type * from '../schemas/index.js'

// Import types for use in union types (for compatibility)
import type {
  SURefAbility,
  SURefBioTitan,
  SURefChassis,
  SURefClass,
  SURefCrawler,
  SURefCrawlerBay,
  SURefCreature,
  SURefDistance,
  SURefDrone,
  SURefEquipment,
  SURefFaction,
  SURefKeyword,
  SURefMeld,
  SURefMetaAbilityTreeRequirement,
  SURefMetaAction,
  SURefMetaCrawlerTechLevel,
  SURefModule,
  SURefNPC,
  SURefPreMadeCharacter,
  SURefRollTable,
  SURefSource,
  SURefTechLevel,
  SURefSquad,
  SURefSystem,
  SURefTrait,
  SURefVehicle,
} from '../schemas/index.js'

// All types are already exported from '../schemas/index.js' above
// This file just re-exports them for backward compatibility

// Union type of all entity types (excludes meta schemas and non-entities)
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
  | SURefKeyword
  | SURefMeld
  | SURefModule
  | SURefNPC
  | SURefPreMadeCharacter
  | SURefRollTable
  | SURefSource
  | SURefSquad
  | SURefSystem
  | SURefTechLevel
  | SURefTrait
  | SURefVehicle

// Union type of all meta entity types (includes all schemas except non-entities)
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
  | SURefModule
  | SURefNPC
  | SURefPreMadeCharacter
  | SURefRollTable
  | SURefSource
  | SURefTechLevel
  | SURefSquad
  | SURefSystem
  | SURefTrait
  | SURefVehicle
