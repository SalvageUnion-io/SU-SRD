export { EntityRefSchema } from './entity'
export type { EntityRef } from './entity'

export { ExportBundleSchema } from './exportBundle'
export type { ExportBundle } from './exportBundle'

export {
  PilotSchema,
  ChoiceSelectionsSchema,
  InjurySchema,
  GenericInventoryEntrySchema,
  CriticalInjuryResultSchema,
} from './pilot'
export type { Pilot, Injury, GenericInventoryEntry, CriticalInjuryResult } from './pilot'

export {
  MechSchema,
  ItemConditionSchema,
  ItemConditionMapSchema,
  CriticalDamageResultSchema,
} from './mech'
export type { Mech, ItemCondition, ItemConditionMap, CriticalDamageResult } from './mech'

export {
  CargoLotSchema,
  CargoLotCategorySchema,
  makeUnitLot,
  makeScrapLot,
  totalLotUnits,
  cargoLotsFromLegacyCargo,
  normalizeLegacyCargoRecord,
} from './cargoLot'
export type { CargoLot, CargoLotCategory } from './cargoLot'

export { CrawlerSchema, ScrapPoolSchema } from './crawler'
export type { Crawler, ScrapPool } from './crawler'

export { WorkspaceSchema } from './workspace'
export type { Workspace } from './workspace'

export { SoftLinkSchema } from './softLink'
export type { SoftLink } from './softLink'

export {
  EncounterNpcSchema,
  EncounterRefSchemaSchema,
  ENCOUNTER_REF_SCHEMAS,
  MediatorRollResultSchema,
  MediatorTableIdSchema,
} from './encounterNpc'
export type {
  EncounterNpc,
  EncounterRefSchema,
  MediatorRollResult,
  MediatorTableId,
} from './encounterNpc'
