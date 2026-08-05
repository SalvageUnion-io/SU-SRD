import abilitiesSchema from '../schemas/abilities.schema.json' with { type: 'json' }
import abilityTreeRequirementsSchema from '../schemas/ability-tree-requirements.schema.json' with {
  type: 'json',
}
import actionsSchema from '../schemas/actions.schema.json' with { type: 'json' }
import bioTitansSchema from '../schemas/bio-titans.schema.json' with { type: 'json' }
import catalogCategoriesSchema from '../schemas/catalog-categories.schema.json' with {
  type: 'json',
}
import chassisSchema from '../schemas/chassis.schema.json' with { type: 'json' }
import classesSchema from '../schemas/classes.schema.json' with { type: 'json' }
import crawlerBaysSchema from '../schemas/crawler-bays.schema.json' with { type: 'json' }
import crawlerTechLevelsSchema from '../schemas/crawler-tech-levels.schema.json' with {
  type: 'json',
}
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
import sourcesSchema from '../schemas/sources.schema.json' with { type: 'json' }
import squadsSchema from '../schemas/squads.schema.json' with { type: 'json' }
import systemsSchema from '../schemas/systems.schema.json' with { type: 'json' }
import techLevelsSchema from '../schemas/tech-levels.schema.json' with { type: 'json' }
import traitsSchema from '../schemas/traits.schema.json' with { type: 'json' }
import vehiclesSchema from '../schemas/vehicles.schema.json' with { type: 'json' }

const SCHEMA_DEFINITIONS: Record<string, Record<string, unknown>> = {
  abilities: abilitiesSchema,
  'ability-tree-requirements': abilityTreeRequirementsSchema,
  actions: actionsSchema,
  'catalog-categories': catalogCategoriesSchema,
  chassis: chassisSchema,
  classes: classesSchema,
  'crawler-bays': crawlerBaysSchema,
  'crawler-tech-levels': crawlerTechLevelsSchema,
  crawlers: crawlersSchema,
  creatures: creaturesSchema,
  distances: distancesSchema,
  drones: dronesSchema,
  equipment: equipmentSchema,
  factions: factionsSchema,
  guides: guidesSchema,
  keywords: keywordsSchema,
  meld: meldSchema,
  modules: modulesSchema,
  npcs: npcsSchema,
  'roll-tables': rollTablesSchema,
  squads: squadsSchema,
  systems: systemsSchema,
  'bio-titans': bioTitansSchema,
  traits: traitsSchema,
  vehicles: vehiclesSchema,
  sources: sourcesSchema,
  'tech-levels': techLevelsSchema,
}

export function getJsonSchemaDefinition(schemaId: string): Record<string, unknown> | undefined {
  return SCHEMA_DEFINITIONS[schemaId]
}

export function getAllJsonSchemaDefinitions(): Record<string, Record<string, unknown>> {
  return SCHEMA_DEFINITIONS
}
