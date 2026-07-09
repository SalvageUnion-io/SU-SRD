/**
 * Registry manifest — the single source of truth for every schema (entity
 * type) the salvageunion-reference package exposes.
 *
 * Adding a new schema type means:
 *   1. Writing the Zod schema in lib/schemas/entities.ts and inferring its
 *      type + adding it to the SURefEntity/SURefMetaEntity unions in
 *      lib/schemas/index.ts AND lib/types/index.ts (hand-authored — these
 *      need human judgment about which unions a schema belongs in).
 *   2. Adding the data file (data/<id>.json) and a catalog entry in
 *      schemas/index.json (hand-authored — prose description, required
 *      fields).
 *   3. Adding ONE entry to the array below.
 *   4. Running `bun run build:package`.
 *
 * Everything else — ModelFactory's dataLoaders / jsonSchemaLoaders /
 * zodSchemaMap / schemaDisplayNames, index.ts's LazyModel instances /
 * lazyModelMap / SchemaToEntityMap / SCHEMA_REGISTRY / static accessors — is
 * generated from this manifest by tools/generateRegistry.ts into
 * lib/generated/*.generated.ts (and, for the static accessors, injected into
 * lib/index.ts between the `GENERATED:BEGIN`/`GENERATED:END` markers).
 * lib/registryConsistency.test.ts independently verifies every generated
 * registry still covers the same key set.
 *
 * This file has ZERO imports on purpose: tools/generateRegistry.ts imports
 * it directly, without pulling in Zod, the data corpus, or any generated
 * code, so codegen never has a circular / bootstrap dependency on its own
 * output.
 */

export type RegistryEntry = {
  /** kebab-case schema id, e.g. "power-cores" — the data/schema filename stem */
  id: string
  /** Exported SURef* type name from lib/schemas/index.ts, e.g. "SURefChassis" */
  typeName: string
  /** Exported Zod schema variable name from lib/schemas/index.ts, e.g. "ChassisSchema" */
  zodExportName: string
  /** Singular display name, e.g. "Chassis" */
  singular: string
  /** Plural display name, e.g. "Chassis" */
  plural: string
  /**
   * Set to `false` for non-entity metadata schemas (e.g. catalog-categories):
   * excluded from EntitySchemaNames and (by convention, hand-enforced in the
   * type unions) the SURefEntity union. Defaults to an entity schema (`true`)
   * when omitted.
   */
  entity?: boolean
}

export const registry: RegistryEntry[] = [
  {
    id: 'abilities',
    typeName: 'SURefAbility',
    zodExportName: 'AbilitySchema',
    singular: 'Ability',
    plural: 'Abilities',
  },
  {
    id: 'ability-tree-requirements',
    typeName: 'SURefMetaAbilityTreeRequirement',
    zodExportName: 'AbilityTreeRequirementSchema',
    singular: 'Ability Tree Requirement',
    plural: 'Ability Tree Requirements',
  },
  {
    id: 'actions',
    typeName: 'SURefMetaAction',
    zodExportName: 'MetaActionSchema',
    singular: 'Action',
    plural: 'Actions',
  },
  {
    id: 'chassis',
    typeName: 'SURefChassis',
    zodExportName: 'ChassisSchema',
    singular: 'Chassis',
    plural: 'Chassis',
  },
  {
    id: 'classes',
    typeName: 'SURefClass',
    zodExportName: 'ClassSchema',
    singular: 'Class',
    plural: 'Classes',
  },
  {
    id: 'crawler-bays',
    typeName: 'SURefCrawlerBay',
    zodExportName: 'CrawlerBaySchema',
    singular: 'Crawler Bay',
    plural: 'Crawler Bays',
  },
  {
    id: 'crawler-tech-levels',
    typeName: 'SURefMetaCrawlerTechLevel',
    zodExportName: 'CrawlerTechLevelSchema',
    singular: 'Crawler Tech Level',
    plural: 'Crawler Tech Levels',
  },
  {
    id: 'crawlers',
    typeName: 'SURefCrawler',
    zodExportName: 'CrawlerSchema',
    singular: 'Crawler',
    plural: 'Crawlers',
  },
  {
    id: 'creatures',
    typeName: 'SURefCreature',
    zodExportName: 'CreatureSchema',
    singular: 'Creature',
    plural: 'Creatures',
  },
  {
    id: 'distances',
    typeName: 'SURefDistance',
    zodExportName: 'DistanceSchema',
    singular: 'Distance',
    plural: 'Distances',
  },
  {
    id: 'drones',
    typeName: 'SURefDrone',
    zodExportName: 'DroneSchema',
    singular: 'Drone',
    plural: 'Drones',
  },
  {
    id: 'equipment',
    typeName: 'SURefEquipment',
    zodExportName: 'EquipmentSchema',
    singular: 'Equipment',
    plural: 'Equipment',
  },
  {
    id: 'factions',
    typeName: 'SURefFaction',
    zodExportName: 'FactionSchema',
    singular: 'Faction',
    plural: 'Factions',
  },
  {
    id: 'guides',
    typeName: 'SURefGuide',
    zodExportName: 'GuideSchema',
    singular: 'Guide',
    plural: 'Guides',
  },
  {
    id: 'keywords',
    typeName: 'SURefKeyword',
    zodExportName: 'KeywordSchema',
    singular: 'Keyword',
    plural: 'Keywords',
  },
  {
    id: 'meld',
    typeName: 'SURefMeld',
    zodExportName: 'MeldSchema',
    singular: 'Meld',
    plural: 'Meld',
  },
  {
    id: 'modules',
    typeName: 'SURefModule',
    zodExportName: 'ModuleSchema',
    singular: 'Module',
    plural: 'Modules',
  },
  { id: 'npcs', typeName: 'SURefNPC', zodExportName: 'NPCSchema', singular: 'NPC', plural: 'NPCs' },
  {
    id: 'roll-tables',
    typeName: 'SURefRollTable',
    zodExportName: 'RollTableSchema',
    singular: 'Roll Table',
    plural: 'Roll Tables',
  },
  {
    id: 'squads',
    typeName: 'SURefSquad',
    zodExportName: 'SquadSchema',
    singular: 'Squad',
    plural: 'Squads',
  },
  {
    id: 'systems',
    typeName: 'SURefSystem',
    zodExportName: 'SystemSchema',
    singular: 'System',
    plural: 'Systems',
  },
  {
    id: 'bio-titans',
    typeName: 'SURefBioTitan',
    zodExportName: 'BioTitanSchema',
    singular: 'Bio-Titan',
    plural: 'Bio-Titans',
  },
  {
    id: 'traits',
    typeName: 'SURefTrait',
    zodExportName: 'TraitEntitySchema',
    singular: 'Trait',
    plural: 'Traits',
  },
  {
    id: 'vehicles',
    typeName: 'SURefVehicle',
    zodExportName: 'VehicleSchema',
    singular: 'Vehicle',
    plural: 'Vehicles',
  },
  {
    id: 'sources',
    typeName: 'SURefSource',
    zodExportName: 'SourceEntitySchema',
    singular: 'Source',
    plural: 'Sources',
  },
  {
    id: 'tech-levels',
    typeName: 'SURefTechLevel',
    zodExportName: 'TechLevelEntitySchema',
    singular: 'Tech Level',
    plural: 'Tech Levels',
  },
  {
    id: 'catalog-categories',
    typeName: 'SURefCatalogCategory',
    zodExportName: 'CatalogCategorySchema',
    singular: 'Catalog Category',
    plural: 'Catalog Categories',
    entity: false,
  },
]
