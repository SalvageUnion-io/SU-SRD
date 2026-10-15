/**
 * Registry manifest — the single source of truth for every schema (entity
 * type) the salvageunion-reference package exposes.
 *
 * Adding a new schema type means:
 *   1. Writing the Zod schema in lib/schemas/entities.ts (exported from the
 *      lib/schemas barrel).
 *   2. Adding the data file (data/<id>.json). The schemas/index.json catalog
 *      entry is generated (prose from the Zod `.describe()`, `meta` below).
 *   3. Adding ONE entry to the array below.
 *   4. Running `bun run build:package`.
 *
 * Everything else — the Ref* entity type aliases and the RefEntity /
 * RefMetaEntity unions (membership decided by `entity` / `excludeFromEntityUnion` below),
 * ModelFactory's dataLoaders /
 * zodSchemaMap / schemaDisplayNames, index.ts's LazyModel instances /
 * lazyModelMap / SchemaToEntityMap / SCHEMA_REGISTRY / static accessors — is
 * generated from this manifest by tools/generateRegistry.ts into
 * lib/generated/*.generated.ts (and, for the static accessors, injected into
 * lib/index.ts between the `GENERATED:BEGIN`/`GENERATED:END` markers).
 * lib/__tests__/registryConsistency.test.ts independently verifies every generated
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
  /** Ref* type name to generate, e.g. "RefChassis" — `z.infer` of `zodExportName` */
  typeName: string
  /** Exported Zod schema variable name from lib/schemas/entities.ts, e.g. "ChassisSchema" */
  zodExportName: string
  /** Singular display name, e.g. "Chassis" */
  singular: string
  /** Plural display name, e.g. "Chassis" */
  plural: string
  /**
   * Set to `false` for non-entity metadata schemas (e.g. catalog-categories):
   * excluded from EntitySchemaNames and from BOTH generated unions
   * (RefEntity and RefMetaEntity). Defaults to an entity schema (`true`)
   * when omitted.
   */
  entity?: boolean
  /**
   * Set to `true` for the rules-metadata schemas (actions, ability-tree
   * requirements, crawler tech levels): they are entities, so they stay in
   * RefMetaEntity and EntitySchemaNames, but they are left out of the
   * narrower RefEntity union. (Unrelated to `meta` below, which is a
   * different set.)
   */
  excludeFromEntityUnion?: boolean
  /**
   * Set to `true` to mark the schema's schemas/index.json catalog entry
   * `meta`: kept out of search and the catalog listing.
   */
  meta?: boolean
  /**
   * Set to `true` to also generate the schema's LIST projection
   * (`lib/generated/<id>.list.generated.json`, rows without their prose — see
   * `lib/listProjection.ts`), loadable with `preload(ids, { projection: 'list' })`.
   */
  listProjection?: boolean
}

export const registry: RegistryEntry[] = [
  {
    id: 'abilities',
    typeName: 'RefAbility',
    zodExportName: 'AbilitySchema',
    singular: 'Ability',
    plural: 'Abilities',
  },
  {
    id: 'ability-tree-requirements',
    typeName: 'RefMetaAbilityTreeRequirement',
    zodExportName: 'AbilityTreeRequirementSchema',
    singular: 'Ability Tree Requirement',
    plural: 'Ability Tree Requirements',
    excludeFromEntityUnion: true,
    meta: true,
  },
  {
    id: 'actions',
    typeName: 'RefMetaAction',
    zodExportName: 'MetaActionSchema',
    singular: 'Action',
    plural: 'Actions',
    excludeFromEntityUnion: true,
    meta: true,
    listProjection: true,
  },
  {
    id: 'chassis',
    typeName: 'RefChassis',
    zodExportName: 'ChassisSchema',
    singular: 'Chassis',
    plural: 'Chassis',
  },
  {
    id: 'classes',
    typeName: 'RefClass',
    zodExportName: 'ClassSchema',
    singular: 'Class',
    plural: 'Classes',
  },
  {
    id: 'crawler-bays',
    typeName: 'RefCrawlerBay',
    zodExportName: 'CrawlerBaySchema',
    singular: 'Crawler Bay',
    plural: 'Crawler Bays',
  },
  {
    id: 'crawler-tech-levels',
    typeName: 'RefMetaCrawlerTechLevel',
    zodExportName: 'CrawlerTechLevelSchema',
    singular: 'Crawler Tech Level',
    plural: 'Crawler Tech Levels',
    excludeFromEntityUnion: true,
  },
  {
    id: 'crawlers',
    typeName: 'RefCrawler',
    zodExportName: 'CrawlerSchema',
    singular: 'Crawler',
    plural: 'Crawlers',
  },
  {
    id: 'creatures',
    typeName: 'RefCreature',
    zodExportName: 'CreatureSchema',
    singular: 'Creature',
    plural: 'Creatures',
  },
  {
    id: 'distances',
    typeName: 'RefDistance',
    zodExportName: 'DistanceSchema',
    singular: 'Distance',
    plural: 'Distances',
  },
  {
    id: 'drones',
    typeName: 'RefDrone',
    zodExportName: 'DroneSchema',
    singular: 'Drone',
    plural: 'Drones',
  },
  {
    id: 'equipment',
    typeName: 'RefEquipment',
    zodExportName: 'EquipmentSchema',
    singular: 'Equipment',
    plural: 'Equipment',
  },
  {
    id: 'factions',
    typeName: 'RefFaction',
    zodExportName: 'FactionSchema',
    singular: 'Faction',
    plural: 'Factions',
  },
  {
    id: 'guides',
    typeName: 'RefGuide',
    zodExportName: 'GuideSchema',
    singular: 'Guide',
    plural: 'Guides',
  },
  {
    id: 'keywords',
    typeName: 'RefKeyword',
    zodExportName: 'KeywordSchema',
    singular: 'Keyword',
    plural: 'Keywords',
  },
  {
    id: 'meld',
    typeName: 'RefMeld',
    zodExportName: 'MeldSchema',
    singular: 'Meld',
    plural: 'Meld',
  },
  {
    id: 'modules',
    typeName: 'RefModule',
    zodExportName: 'ModuleSchema',
    singular: 'Module',
    plural: 'Modules',
  },
  { id: 'npcs', typeName: 'RefNPC', zodExportName: 'NPCSchema', singular: 'NPC', plural: 'NPCs' },
  {
    id: 'roll-tables',
    typeName: 'RefRollTable',
    zodExportName: 'RollTableSchema',
    singular: 'Roll Table',
    plural: 'Roll Tables',
  },
  {
    id: 'squads',
    typeName: 'RefSquad',
    zodExportName: 'SquadSchema',
    singular: 'Squad',
    plural: 'Squads',
  },
  {
    id: 'systems',
    typeName: 'RefSystem',
    zodExportName: 'SystemSchema',
    singular: 'System',
    plural: 'Systems',
  },
  {
    id: 'bio-titans',
    typeName: 'RefBioTitan',
    zodExportName: 'BioTitanSchema',
    singular: 'Bio-Titan',
    plural: 'Bio-Titans',
  },
  {
    id: 'traits',
    typeName: 'RefTrait',
    zodExportName: 'TraitEntitySchema',
    singular: 'Trait',
    plural: 'Traits',
  },
  {
    id: 'vehicles',
    typeName: 'RefVehicle',
    zodExportName: 'VehicleSchema',
    singular: 'Vehicle',
    plural: 'Vehicles',
  },
  {
    id: 'sources',
    typeName: 'RefSource',
    zodExportName: 'SourceEntitySchema',
    singular: 'Source',
    plural: 'Sources',
  },
  {
    id: 'tech-levels',
    typeName: 'RefTechLevel',
    zodExportName: 'TechLevelEntitySchema',
    singular: 'Tech Level',
    plural: 'Tech Levels',
  },
  {
    id: 'catalog-categories',
    typeName: 'RefCatalogCategory',
    zodExportName: 'CatalogCategorySchema',
    singular: 'Catalog Category',
    plural: 'Catalog Categories',
    entity: false,
    meta: true,
  },
]
