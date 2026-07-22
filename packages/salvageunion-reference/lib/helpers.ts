/**
 * Helper functions for common operations on Salvage Union reference data
 * These functions provide convenient access patterns used by consuming applications
 */

import { SalvageUnionReference, SchemaToDisplayName, SchemaToModelMap } from './index.js'
import type {
  SURefAbility,
  SURefChassis,
  SURefClass,
  SURefCrawler,
  SURefMetaCrawlerTechLevel,
  SURefEntity,
  SURefEnumSchemaName,
  SURefObjectAdvancedClass,
  SURefObjectCrawlerMutation,
} from './types/index.js'
import type { EntitySchemaName } from './index.js'
import type { ModelWithMetadata } from './BaseModel.js'
import { getSchemaCatalog, type EnhancedSchemaMetadata } from './ModelFactory.js'
import {
  getName,
  getDescription,
  getSource,
  getTree,
  getPageReference,
  getTechLevel,
  getAssetUrl,
  getContent,
  getStructurePoints,
  getEnergyPoints,
  getHeatCapacity,
  getSystemSlots,
  getModuleSlots,
  getCargoCapacity,
  getSalvageValue,
  getSlotsRequired,
  getHitPoints,
  getTraits,
  getActionType,
  getRange,
  getDamage,
} from './utilities.js'
import { getEntitySlug } from './slug.js'
import { ActionTypeSchema } from './schemas/enums.js'

/**
 * Get the display name for a schema
 * @param schemaName - The schema name
 * @returns The display name or the schema name if not found
 */
export function getDisplayName(schemaName: SURefEnumSchemaName): string {
  return SchemaToDisplayName[schemaName] || schemaName
}

/**
 * Normalize a schema name to the canonical form
 * Handles aliases like 'classes-core' -> 'classes', 'classes-hybrid' -> 'classes'
 * @param schemaName - The schema name (may be an alias)
 * @returns The normalized schema name
 */
export function normalizeSchemaName(schemaName: string): SURefEnumSchemaName {
  // Handle class schema aliases - all map to unified 'classes' schema
  if (
    schemaName === 'classes-core' ||
    schemaName === 'classes.core' ||
    schemaName === 'classes-advanced' ||
    schemaName === 'classes.advanced' ||
    schemaName === 'classes-hybrid' ||
    schemaName === 'classes.hybrid'
  ) {
    return 'classes'
  }

  // Return as-is if it's already a valid schema name
  return schemaName as SURefEnumSchemaName
}

/**
 * Get a model by schema name
 * Automatically normalizes schema name aliases (e.g., 'classes-core' -> 'classes')
 * @param schemaName - The schema name (may be an alias)
 * @returns The model instance or undefined if not found
 */
export function getModel(
  schemaName: string | SURefEnumSchemaName
): ModelWithMetadata<SURefEntity> | undefined {
  const normalized = normalizeSchemaName(schemaName)
  const modelName: string | undefined = SchemaToModelMap[normalized]
  if (!modelName) return undefined
  return (SalvageUnionReference as unknown as Record<string, ModelWithMetadata<SURefEntity>>)[
    modelName
  ]
}

/**
 * Resolve an entity's `grants` into the granted entities, skipping `choice`
 * grants (handled separately). Single source of truth for the grant-resolution
 * walk — used by the display layer (Grants block) and any tooling.
 */
export function resolveGrantedEntities(entity: SURefEntity): SURefEntity[] {
  const grants =
    'grants' in entity && Array.isArray(entity.grants)
      ? (entity.grants as Array<{ name: string; schema: string }>)
      : []
  return grants
    .filter((grant) => grant.schema !== 'choice')
    .map(
      (grant): SURefEntity | null =>
        getModel(grant.schema.toLowerCase())?.find(
          (e: SURefEntity) => 'name' in e && e.name === grant.name
        ) ?? null
    )
    .filter((e): e is SURefEntity => e !== null)
}

/**
 * Get a map of all schema names to their models
 * Useful for dynamic model access
 */
export function getModelMap(): Record<SURefEnumSchemaName, ModelWithMetadata<SURefEntity>> {
  const map = {} as Record<SURefEnumSchemaName, ModelWithMetadata<SURefEntity>>
  for (const schemaName in SchemaToModelMap) {
    const model = getModel(schemaName as SURefEnumSchemaName)
    if (model) {
      map[schemaName as SURefEnumSchemaName] = model
    }
  }
  return map
}

/**
 * Find an entity by ID in any schema (only works with entity schemas, not meta schemas)
 * @param schemaName - The schema to search in (must be an entity schema)
 * @param id - The entity ID
 * @returns The entity or undefined if not found
 */
export function findById<T extends SURefEntity>(
  schemaName: EntitySchemaName,
  id: string
): T | undefined {
  return SalvageUnionReference.get(schemaName, id) as T | undefined
}

/**
 * Get the name of an entity by ID with fallback (only works with entity schemas, not meta schemas)
 * @param schemaName - The schema to search in (must be an entity schema)
 * @param id - The entity ID
 * @param fallback - Fallback string if entity not found (default: 'Unknown')
 * @returns The entity name or fallback
 */
export function getNameById(
  schemaName: EntitySchemaName,
  id: string | null,
  fallback = 'Unknown'
): string {
  if (!id) return fallback
  const entity = SalvageUnionReference.get(schemaName, id)
  return entity && 'name' in entity && typeof entity.name === 'string' ? entity.name : fallback
}

// ============================================================================
// CLASS HELPERS
// ============================================================================

/**
 * Type guard to check if a class is a base class (has coreTrees)
 */
export function isBaseClass(cls: SURefClass): cls is SURefClass & { coreTrees: string[] } {
  return 'coreTrees' in cls && Array.isArray(cls.coreTrees)
}

/**
 * Get all base classes (classes with coreTrees)
 * @returns Array of base classes
 */
export function getCoreClasses(): (SURefClass & { schemaName: string })[] {
  return SalvageUnionReference.findAllIn(
    'classes',
    (c) => 'coreTrees' in c && Array.isArray(c.coreTrees)
  )
}

/**
 * Get all hybrid classes (classes with hybrid=true)
 * @returns Array of hybrid classes
 */
export function getHybridClasses(): (SURefObjectAdvancedClass & {
  schemaName: string
})[] {
  return SalvageUnionReference.Classes.all().filter(
    (c): c is SURefObjectAdvancedClass & { schemaName: string } =>
      'hybrid' in c && c.hybrid === true
  )
}

/**
 * Get all base classes with advanced/legendary trees (advanceable base classes)
 * @returns Array of advanceable base classes
 */
export function getAdvanceableClasses(): SURefClass[] {
  return SalvageUnionReference.findAllIn(
    'classes',
    (c) => 'coreTrees' in c && 'advanceable' in c && c.advanceable === true
  )
}

/**
 * Find a base class by name
 * @param className - Name of the class to find
 * @returns The base class or undefined if not found
 */
export function findCoreClass(className: string): SURefClass | undefined {
  return SalvageUnionReference.findIn('classes', (c) => c.name === className && 'coreTrees' in c)
}

/**
 * Find a hybrid class by name
 * @param className - Name of the class to find
 * @returns The hybrid class or undefined if not found
 */
export function findHybridClass(className: string): SURefObjectAdvancedClass | undefined {
  const cls = SalvageUnionReference.findIn('classes', (c) => c.name === className)
  if (cls && 'hybrid' in cls && cls.hybrid === true) {
    return cls
  }
  return undefined
}

/**
 * Find an advanced class by name (base class that has advancedTree)
 * @param className - Name of the base class to find
 * @returns The base class with advanced tree or undefined if not found
 */
export function findAdvancedClass(className: string): SURefClass | undefined {
  const cls = SalvageUnionReference.findIn('classes', (c) => c.name === className)
  if (cls && 'coreTrees' in cls && 'advancedTree' in cls && cls.advancedTree) {
    return cls
  }
  return undefined
}

/**
 * Find a class by name across all class types (base, hybrid)
 * @param className - Name of the class to find
 * @returns The class or undefined if not found
 */
export function findClass(className: string): SURefClass | undefined {
  return SalvageUnionReference.findIn('classes', (c) => c.name === className)
}

// ============================================================================
// CHASSIS HELPERS
// ============================================================================

/**
 * Get chassis that have patterns
 * @returns Array of chassis with patterns
 */
export function getChassisWithPatterns(): SURefChassis[] {
  return SalvageUnionReference.findAllIn('chassis', (c) => c.patterns && c.patterns.length > 0)
}

/**
 * Find a chassis by ID
 * @param chassisId - The ID of the chassis to find
 * @returns The chassis or undefined if not found
 */
export function findChassisById(chassisId: string): SURefChassis | undefined {
  return SalvageUnionReference.findIn('chassis', (c) => c.id === chassisId)
}

/**
 * Get chassis name by ID with fallback
 * @param chassisId - The ID of the chassis to find
 * @param fallback - Fallback string if chassis not found (default: 'Unknown')
 * @returns The chassis name or fallback
 */
export function getChassisNameById(chassisId: string | null, fallback = 'Unknown'): string {
  if (!chassisId) return fallback
  return findChassisById(chassisId)?.name ?? fallback
}

// ============================================================================
// CRAWLER HELPERS
// ============================================================================

/**
 * Find a crawler by ID
 * @param crawlerId - The ID of the crawler to find
 * @returns The crawler or undefined if not found
 */
export function findCrawlerById(
  crawlerId: string
): (SURefCrawler & { schemaName: string }) | undefined {
  return SalvageUnionReference.findIn('crawlers', (c) => c.id === crawlerId)
}

/**
 * Get crawler name by ID with fallback
 * @param crawlerId - The ID of the crawler to find
 * @param fallback - Fallback string if crawler not found (default: 'Unknown')
 * @returns The crawler name or fallback
 */
export function getCrawlerNameById(crawlerId: string | null, fallback = 'Unknown'): string {
  if (!crawlerId) return fallback
  return findCrawlerById(crawlerId)?.name ?? fallback
}

/**
 * Get all mutations for a crawler type by ID
 * @param crawlerId - The crawler type ID
 * @returns Array of mutations, or empty array if none
 */
export function getCrawlerMutations(crawlerId: string): SURefObjectCrawlerMutation[] {
  const crawler = findCrawlerById(crawlerId)
  return crawler?.mutations ?? []
}

/**
 * Get the total weapon slot count for a crawler type.
 * Base is 1 (from the Armament Bay) plus any weapon_slots mutations.
 * @param crawlerId - The crawler type ID
 * @returns Total weapon slots available
 */
export function getWeaponSlotCount(crawlerId: string): number {
  const mutations = getCrawlerMutations(crawlerId)
  const bonus = mutations
    .filter((m) => m.type === 'weapon_slots')
    .reduce((sum, m) => sum + m.value, 0)
  return 1 + bonus
}

/**
 * Get the max SP bonus from a crawler type's mutations.
 * @param crawlerId - The crawler type ID
 * @returns Sum of max_sp_bonus mutation values
 */
export function getMaxSpBonus(crawlerId: string): number {
  const mutations = getCrawlerMutations(crawlerId)
  return mutations.filter((m) => m.type === 'max_sp_bonus').reduce((sum, m) => sum + m.value, 0)
}

/**
 * Normalize tech level to a number for calculations
 * Treats "B" (Bio) and "N" (Nanite) as 1
 * @param techLevel - The tech level (number, 'B', or 'N')
 * @returns The numeric tech level
 */
export function normalizeTechLevel(techLevel: number | 'B' | 'N' | null | undefined): number {
  if (techLevel === null || techLevel === undefined) return 0
  if (techLevel === 'B' || techLevel === 'N') return 1
  return techLevel
}

/**
 * Find a crawler tech level by level number
 * @param techLevel - The tech level number to find
 * @returns The tech level or undefined if not found
 */
export function findCrawlerTechLevel(
  techLevel: number
): (SURefMetaCrawlerTechLevel & { schemaName: string }) | undefined {
  return SalvageUnionReference.CrawlerTechLevels.find((tl) => tl.techLevel === techLevel)
}

/**
 * Get structure points for a tech level with fallback
 * @param techLevel - The tech level number (or 'B'/'N' which are treated as 1)
 * @param fallback - Fallback number if tech level not found (default: 20)
 * @returns The structure points or fallback
 */
export function getStructurePointsForTechLevel(
  techLevel: number | 'B' | 'N' | null,
  fallback = 20
): number {
  if (techLevel === null) return fallback
  const normalized = normalizeTechLevel(techLevel)
  return findCrawlerTechLevel(normalized)?.structurePoints ?? fallback
}

// ============================================================================
// ABILITY HELPERS
// ============================================================================

/**
 * Get abilities by level
 * @param level - The ability level
 * @returns Array of abilities at that level
 */
export function getAbilitiesByLevel(level: number): (SURefAbility & { schemaName: string })[] {
  return SalvageUnionReference.Abilities.all().filter((a) => a.level === level)
}

// ============================================================================
// EQUIPMENT HELPERS
// ============================================================================

// ============================================================================
// TECH LEVEL HELPERS
// ============================================================================

/**
 * Get all tech levels as an array of numbers
 * Derived from crawler-tech-levels data
 * @returns Array of tech level numbers (1-6)
 */
export function getTechLevels(): readonly number[] {
  const techLevels = SalvageUnionReference.CrawlerTechLevels.all()
    .map((tl) => tl.techLevel)
    .sort((a, b) => a - b)
  return techLevels
}

/**
 * Minimum tech level (always 1)
 */
export const MIN_TECH_LEVEL = 1

/**
 * Maximum tech level
 * Derived from crawler-tech-levels data
 */
export function getMaxTechLevel(): number {
  const techLevels = getTechLevels()
  return techLevels[techLevels.length - 1] || 6
}

/**
 * Get scrap conversion rate for a tech level
 * Each tech level is worth its numeric value in TL1 scrap
 * "B" (Bio) and "N" (Nanite) are treated as 1
 * @param techLevel - The tech level (1-6, 'B', or 'N')
 * @returns The conversion rate (tech level value)
 */
export function getScrapConversionRate(techLevel: number | 'B' | 'N'): number {
  return normalizeTechLevel(techLevel)
}

/**
 * Get all scrap conversion rates as a record
 * @returns Record mapping tech level to conversion rate
 */
export function getScrapConversionRates(): Record<number, number> {
  const techLevels = getTechLevels()
  const rates: Record<number, number> = {}
  for (const tl of techLevels) {
    rates[tl] = getScrapConversionRate(tl)
  }
  return rates
}

// ============================================================================
// GAME RULE CONSTANTS
// ============================================================================

/**
 * Pilot default values
 * These are standard starting values for pilots
 */
export const PILOT_DEFAULTS = {
  maxHP: 10,
  maxAP: 5,
  startingTP: 0,
  inventorySlots: 6,
} as const

/**
 * Crawler default values
 * Derived from crawler-tech-levels data (TL1 defaults)
 */
export const CRAWLER_DEFAULTS = {
  initialTechLevel: 1,
  baseStructurePoints: 20, // TL1 structure points
  baseUpgrade: 0,
} as const

/**
 * Mech default values
 * Standard starting values for mechs
 */
export const MECH_DEFAULTS = {
  startingDamage: 0,
  startingHeat: 0,
} as const

/**
 * Crawler upkeep and upgrade rules
 * Upkeep cost increases by `step` scrap per tech level; max upgrade cap.
 */
export const UPKEEP_RULES = {
  step: 5,
  maxUpgrade: 25,
} as const

/**
 * Resolve the activation currency for a given schema/entity category.
 * Mech-level sources (chassis, systems, modules) cost EP; variable-cost abilities
 * cost XP; everything else costs AP.
 */
export function resolveActivationCurrency(
  schemaName: SURefEnumSchemaName | 'actions' | undefined,
  variable: boolean = false
): 'AP' | 'EP' | 'XP' {
  if (variable) return 'XP'
  if (schemaName === 'chassis' || schemaName === 'systems' || schemaName === 'modules') return 'EP'
  return 'AP'
}

/**
 * Get the list of action types from the ActionType enum schema.
 * Returns the canonical values: Passive, Free, Reaction, Turn, Short, Long, DownTime.
 */
export function getActionTypes(): string[] {
  return ActionTypeSchema.options
}

// ============================================================================
// SCHEMA HELPERS
// ============================================================================

/**
 * Get all entity schemas (non-meta schemas)
 * Filters out meta schemas like actions, ability-tree-requirements, etc.
 * @returns Array of entity schema metadata
 */
export function getEntitySchemas(): EnhancedSchemaMetadata[] {
  return getSchemaCatalog().schemas.filter((s) => !s.meta)
}

// ============================================================================
// FACET EXTRACTION HELPERS
// ============================================================================

/**
 * Get unique tech levels from an array of entities, sorted correctly
 * Numeric levels ascending, then 'B', then 'N'
 * @param entities - Array of entities to extract tech levels from
 * @returns Sorted array of unique tech levels
 */
export function getUniqueTechLevels(entities: SURefEntity[]): (number | 'B' | 'N')[] {
  const levels = new Set<number | 'B' | 'N'>()
  for (const entity of entities) {
    const tl = getTechLevel(entity)
    if (tl !== undefined) levels.add(tl)
  }
  return Array.from(levels).sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b
    if (typeof a === 'number') return -1
    if (typeof b === 'number') return 1
    if (a === 'B' && b === 'N') return -1
    if (a === 'N' && b === 'B') return 1
    return 0
  })
}

/**
 * Get unique source strings from an array of entities.
 * "Salvage Union Workshop Manual" is always first; the rest are sorted alphabetically.
 * @param entities - Array of entities to extract sources from
 * @returns Sorted array of unique source strings
 */
export function getUniqueSources(entities: SURefEntity[]): string[] {
  const sourceSet = new Set<string>()
  for (const entity of entities) {
    const source = getSource(entity)
    if (source) sourceSet.add(source)
  }
  const PRIMARY_SOURCE = 'Salvage Union Workshop Manual'
  const sorted = Array.from(sourceSet).sort()
  if (sorted.includes(PRIMARY_SOURCE)) {
    return [PRIMARY_SOURCE, ...sorted.filter((s) => s !== PRIMARY_SOURCE)]
  }
  return sorted
}

/**
 * Get unique ability-tree strings from an array of entities, sorted alphabetically.
 * Only abilities carry a `tree`; entities without one are skipped.
 * @param entities - Array of entities to extract trees from
 * @returns Sorted array of unique tree strings
 */
export function getUniqueTrees(entities: SURefEntity[]): string[] {
  const treeSet = new Set<string>()
  for (const entity of entities) {
    const tree = getTree(entity)
    if (typeof tree === 'string' && tree) treeSet.add(tree)
  }
  return Array.from(treeSet).sort()
}

// ============================================================================
// ENTITY DISPLAY DATA
// ============================================================================

/**
 * Aggregate display data extracted from an entity
 */
export type ReferenceEntityData = {
  id: string
  name: string
  slug: string
  description: string | undefined
  source: string | undefined
  page: number | undefined
  techLevel: number | 'B' | 'N' | undefined
  assetUrl: string | undefined
}

/**
 * Extract common display data from an entity in one call
 * Eliminates repeated defensive field extraction across consumers
 * @param entity - The entity to extract display data from
 * @returns Aggregated display data
 */
export function getReferenceEntityData(entity: SURefEntity): ReferenceEntityData {
  return {
    id: entity.id,
    name: getName(entity) ?? entity.id,
    slug: getEntitySlug(entity),
    description: getDescription(entity),
    source: getSource(entity),
    page: getPageReference(entity),
    techLevel: getTechLevel(entity),
    assetUrl: getAssetUrl(entity),
  }
}

// ============================================================================
// STATIC ENTITY SUMMARY (SEO)
// ============================================================================

/**
 * Static summary data extracted from an entity for SEO/static HTML rendering
 */
export type StaticEntitySummary = {
  name: string
  description: string | undefined
  source: string | undefined
  page: number | undefined
  techLevel: number | 'B' | 'N' | undefined
  contentParagraphs: string[]
  stats: { label: string; value: string | number }[]
  traits: string[]
}

/**
 * Extract a static summary from an entity for server-side rendering (SEO)
 * Collects text content, numeric stats, and trait names into a flat structure
 * suitable for rendering as static HTML at build time.
 * @param entity - The entity to extract a summary from
 * @returns Static summary data
 */
export function extractStaticEntitySummary(entity: SURefEntity): StaticEntitySummary {
  const name = getName(entity) ?? entity.id
  const description = getDescription(entity)
  const source = getSource(entity)
  const page = getPageReference(entity)
  const techLevel = getTechLevel(entity)

  // Extract paragraph text from content blocks
  const contentParagraphs: string[] = []
  const content = getContent(entity)
  if (Array.isArray(content)) {
    for (const block of content) {
      if (
        block &&
        typeof block === 'object' &&
        (!block.type || block.type === 'paragraph') &&
        typeof block.value === 'string'
      ) {
        contentParagraphs.push(block.value)
      }
    }
  }

  // Collect numeric stats
  const stats: { label: string; value: string | number }[] = []

  const sp = getStructurePoints(entity)
  if (sp != null) stats.push({ label: 'Structure Points', value: sp })

  const ep = getEnergyPoints(entity)
  if (ep != null) stats.push({ label: 'Energy Points', value: ep })

  const hc = getHeatCapacity(entity)
  if (hc != null) stats.push({ label: 'Heat Capacity', value: hc })

  const ss = getSystemSlots(entity)
  if (ss != null) stats.push({ label: 'System Slots', value: ss })

  const ms = getModuleSlots(entity)
  if (ms != null) stats.push({ label: 'Module Slots', value: ms })

  const cc = getCargoCapacity(entity)
  if (cc != null) stats.push({ label: 'Cargo Capacity', value: cc })

  const sv = getSalvageValue(entity)
  if (sv != null) stats.push({ label: 'Salvage Value', value: sv })

  const sr = getSlotsRequired(entity)
  if (sr != null) stats.push({ label: 'Slots Required', value: sr })

  const hp = getHitPoints(entity)
  if (hp != null) stats.push({ label: 'Hit Points', value: hp })

  if (techLevel != null) stats.push({ label: 'Tech Level', value: techLevel })

  const actionType = getActionType(entity)
  if (actionType) stats.push({ label: 'Action Type', value: actionType })

  const range = getRange(entity)
  if (range) stats.push({ label: 'Range', value: range.join(', ') })

  const damage = getDamage(entity)
  if (damage)
    stats.push({
      label: 'Damage',
      value: `${damage.amount} ${damage.damageType}`,
    })

  // Extract trait names
  const traits: string[] = []
  const entityTraits = getTraits(entity)
  if (entityTraits) {
    for (const t of entityTraits) {
      if (t && typeof t === 'object' && 'type' in t && typeof t.type === 'string') {
        traits.push(t.type)
      }
    }
  }

  return {
    name,
    description,
    source,
    page,
    techLevel,
    contentParagraphs,
    stats,
    traits,
  }
}
