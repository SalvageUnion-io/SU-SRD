import abilitiesSchema from '../schemas/abilities.schema.json'
import abilityTreeRequirementsSchema from '../schemas/ability-tree-requirements.schema.json'
import actionsSchema from '../schemas/actions.schema.json'
import bioTitansSchema from '../schemas/bio-titans.schema.json'
import catalogCategoriesSchema from '../schemas/catalog-categories.schema.json'
import chassisSchema from '../schemas/chassis.schema.json'
import classesSchema from '../schemas/classes.schema.json'
import crawlerBaysSchema from '../schemas/crawler-bays.schema.json'
import crawlerTechLevelsSchema from '../schemas/crawler-tech-levels.schema.json'
import crawlersSchema from '../schemas/crawlers.schema.json'
import creaturesSchema from '../schemas/creatures.schema.json'
import distancesSchema from '../schemas/distances.schema.json'
import dronesSchema from '../schemas/drones.schema.json'
import equipmentSchema from '../schemas/equipment.schema.json'
import factionsSchema from '../schemas/factions.schema.json'
import guidesSchema from '../schemas/guides.schema.json'
import keywordsSchema from '../schemas/keywords.schema.json'
import meldSchema from '../schemas/meld.schema.json'
import modulesSchema from '../schemas/modules.schema.json'
import npcsSchema from '../schemas/npcs.schema.json'
import rollTablesSchema from '../schemas/roll-tables.schema.json'
import squadsSchema from '../schemas/squads.schema.json'
import systemsSchema from '../schemas/systems.schema.json'
import traitsSchema from '../schemas/traits.schema.json'
import vehiclesSchema from '../schemas/vehicles.schema.json'
import sourcesSchema from '../schemas/sources.schema.json'
import techLevelsSchema from '../schemas/tech-levels.schema.json'

const SCHEMA_DEFINITIONS: Record<string, Record<string, unknown>> = {
  abilities: abilitiesSchema as Record<string, unknown>,
  'ability-tree-requirements': abilityTreeRequirementsSchema as Record<string, unknown>,
  actions: actionsSchema as Record<string, unknown>,
  'bio-titans': bioTitansSchema as Record<string, unknown>,
  'catalog-categories': catalogCategoriesSchema as Record<string, unknown>,
  chassis: chassisSchema as Record<string, unknown>,
  classes: classesSchema as Record<string, unknown>,
  'crawler-bays': crawlerBaysSchema as Record<string, unknown>,
  'crawler-tech-levels': crawlerTechLevelsSchema as Record<string, unknown>,
  crawlers: crawlersSchema as Record<string, unknown>,
  creatures: creaturesSchema as Record<string, unknown>,
  distances: distancesSchema as Record<string, unknown>,
  drones: dronesSchema as Record<string, unknown>,
  equipment: equipmentSchema as Record<string, unknown>,
  factions: factionsSchema as Record<string, unknown>,
  guides: guidesSchema as Record<string, unknown>,
  keywords: keywordsSchema as Record<string, unknown>,
  meld: meldSchema as Record<string, unknown>,
  modules: modulesSchema as Record<string, unknown>,
  npcs: npcsSchema as Record<string, unknown>,
  'roll-tables': rollTablesSchema as Record<string, unknown>,
  squads: squadsSchema as Record<string, unknown>,
  systems: systemsSchema as Record<string, unknown>,
  traits: traitsSchema as Record<string, unknown>,
  vehicles: vehiclesSchema as Record<string, unknown>,
  sources: sourcesSchema as Record<string, unknown>,
  'tech-levels': techLevelsSchema as Record<string, unknown>,
}

export function getJsonSchemaDefinition(schemaId: string): Record<string, unknown> | undefined {
  return SCHEMA_DEFINITIONS[schemaId]
}

export function getAllJsonSchemaDefinitions(): Record<string, Record<string, unknown>> {
  return SCHEMA_DEFINITIONS
}
