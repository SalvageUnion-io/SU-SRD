import abilitiesSchema from '../schemas/abilities.schema.json' with { type: 'json' }
import abilityTreeRequirementsSchema from '../schemas/ability-tree-requirements.schema.json' with { type: 'json' }
import actionsSchema from '../schemas/actions.schema.json' with { type: 'json' }
import catalogCategoriesSchema from '../schemas/catalog-categories.schema.json' with { type: 'json' }
import chassisSchema from '../schemas/chassis.schema.json' with { type: 'json' }
import classesSchema from '../schemas/classes.schema.json' with { type: 'json' }
import crawlerBaysSchema from '../schemas/crawler-bays.schema.json' with { type: 'json' }
import crawlerTechLevelsSchema from '../schemas/crawler-tech-levels.schema.json' with { type: 'json' }
import crawlersSchema from '../schemas/crawlers.schema.json' with { type: 'json' }
import creaturesSchema from '../schemas/creatures.schema.json' with { type: 'json' }
import distancesSchema from '../schemas/distances.schema.json' with { type: 'json' }
import dronesSchema from '../schemas/drones.schema.json' with { type: 'json' }
import equipmentSchema from '../schemas/equipment.schema.json' with { type: 'json' }
import factionsSchema from '../schemas/factions.schema.json' with { type: 'json' }
import guidesSchema from '../schemas/guides.schema.json' with { type: 'json' }
import keywordsSchema from '../schemas/keywords.schema.json' with { type: 'json' }
import meldSchema from '../schemas/meld.schema.json' with { type: 'json' }
import modulesSchema from '../schemas/modules.schema.json' with { type: 'json' }
import npcsSchema from '../schemas/npcs.schema.json' with { type: 'json' }
import rollTablesSchema from '../schemas/roll-tables.schema.json' with { type: 'json' }
import squadsSchema from '../schemas/squads.schema.json' with { type: 'json' }
import systemsSchema from '../schemas/systems.schema.json' with { type: 'json' }
import titansSchema from '../schemas/titans.schema.json' with { type: 'json' }
import traitsSchema from '../schemas/traits.schema.json' with { type: 'json' }
import vehiclesSchema from '../schemas/vehicles.schema.json' with { type: 'json' }
import sourcesSchema from '../schemas/sources.schema.json' with { type: 'json' }
import techLevelsSchema from '../schemas/tech-levels.schema.json' with { type: 'json' }

const SCHEMA_DEFINITIONS: Record<string, Record<string, unknown>> = {
  abilities: abilitiesSchema as Record<string, unknown>,
  'ability-tree-requirements': abilityTreeRequirementsSchema as Record<string, unknown>,
  actions: actionsSchema as Record<string, unknown>,
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
  titans: titansSchema as Record<string, unknown>,
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
