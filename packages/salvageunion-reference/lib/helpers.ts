/**
 * Helper functions for common operations on Salvage Union reference data
 * These functions provide convenient access patterns used by consuming applications
 */

import type { ModelWithMetadata } from './BaseModel.js'
import { lazyModelMap } from './generated/schemaRegistry.generated.js'
import { SalvageUnionReference, SchemaToDisplayName } from './index.js'
import type { EnhancedSchemaMetadata } from './ModelFactory.js'
import { getSchemaCatalog } from './ModelFactory.js'
import { getEntitySlug } from './slug.js'
import type { SURefEntity, SURefEnumSchemaName, SURefObjectAdvancedClass } from './types/index.js'
import {
  getActionType,
  getAssetUrl,
  getCargoCapacity,
  getContent,
  getDamage,
  getDescription,
  getEnergyPoints,
  getHeatCapacity,
  getHitPoints,
  getModuleSlots,
  getName,
  getPageReference,
  getRange,
  getSalvageValue,
  getSlotsRequired,
  getSource,
  getStructurePoints,
  getSystemSlots,
  getTechLevel,
  getTraits,
  getTree,
} from './utilities.js'
import { isColumnsTable } from './utils/resultForTable.js'
import type { TableRow } from './utils/tableRows.js'
import { tableRows } from './utils/tableRows.js'

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

  // Sole assertion: lazyModelMap's per-schema union includes meta-entity models
  // (ability-tree-requirements, crawler-tech-levels) whose element types are not
  // in SURefEntity, so the union cannot be assigned to the declared
  // SURefEntity-typed model. `| undefined` stays honest for runtime-invalid
  // schema names passed through normalizeSchemaName's string overload.
  return lazyModelMap[normalized] as ModelWithMetadata<SURefEntity> | undefined
}

/**
 * Resolve an entity's `grants` into the granted entities, skipping `choice`
 * grants (handled separately). Single source of truth for the grant-resolution
 * walk — used by the display layer (Grants block) and any tooling.
 */

export function resolveGrantedEntities(entity: SURefEntity): SURefEntity[] {
  const grants = 'grants' in entity && Array.isArray(entity.grants) ? entity.grants : []
  return (
    grants
      .filter((grant) => grant.schema !== 'choice')
      // `getByName` (the model's name index), not a `.find` predicate: this walk
      // runs per grant per render, and the predicate form scanned the whole
      // target schema each time.
      .map(
        (grant): SURefEntity | null =>
          getModel(grant.schema.toLowerCase())?.getByName(grant.name) ?? null
      )
      .filter((e): e is SURefEntity => e !== null)
  )
}

// ============================================================================
// CLASS HELPERS
// ============================================================================

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

// ============================================================================
// CRAWLER HELPERS
// ============================================================================

// ============================================================================
// GAME RULE CONSTANTS
// ============================================================================

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
 * Sort rank for a Tech Level: the numeric tiers 1–6 keep their own value, then
 * Bio ('B') at 7 and Nanite ('N') at 8.
 *
 * This ordering is a property of the game's TAXONOMY, not of any one widget, so
 * it lives here and every sorter composes it (`techLevelRank(a) -
 * techLevelRank(b)`) rather than re-deriving it. A missing Tech Level ranks
 * last — an entity with no TL has no place among the tiers, and Infinity keeps
 * it out of the way of both the numeric run and B/N without inventing a tier
 * for it.
 *
 * @param techLevel - A Tech Level (as returned by `getTechLevel`), or undefined
 * @returns The sort rank
 */

export function techLevelRank(techLevel: number | 'B' | 'N' | undefined): number {
  if (techLevel === 'B') return 7
  if (techLevel === 'N') return 8
  return typeof techLevel === 'number' ? techLevel : Number.POSITIVE_INFINITY
}

/**
 * The canonical "Tech Level, then name" comparator.
 *
 * This exists because the expression it replaces was written out by hand at
 * three call sites and one of them got it wrong — using `Number(a.techLevel)`
 * instead of {@link techLevelRank}. The failure is quieter than it first looks:
 * `Number('B') - 1` is `NaN`, and `NaN` is FALSY, so the `||` falls straight
 * through to the name tiebreak. A Bio or Nanite item is therefore not randomly
 * ordered — it is ordered purely by NAME, interleaved among the numeric tiers
 * instead of sorted after them. Plausible-looking output is exactly why it
 * survived at two call sites. It was dormant only by luck of the data:
 * `equipment.json` happens to carry no Bio or Nanite entries, while
 * `systems.json` has 7 B + 3 N and `modules.json` 3 B + 3 N — so the same
 * expression copied one file over ships a scrambled list.
 *
 * A comparator is exactly the kind of thing that should not be re-derived per
 * widget: the ordering is a property of the game's taxonomy, the bug is silent,
 * and the wrong version looks right.
 *
 * **One hand-rolled comparator is deliberately NOT folded in.**
 * `component-lib/src/components/shared/EntitySearcher.tsx` composes
 * `techLevelRank` correctly — no NaN — but short-circuits to the name tiebreak
 * whenever EITHER side's Tech Level is `undefined`, where this ranks `undefined`
 * last. That is a real behavioural difference on TL-less entities, not a
 * cosmetic one, so switching it is a decision about search ordering rather than
 * a de-duplication. Left alone on purpose; noted here so "all the call sites use
 * the shared one" is not read as a claim about that file.
 *
 * @param a - Entity-shaped value carrying a Tech Level and a name
 * @param b - The value to compare against
 * @returns Negative, zero or positive, per Array#sort
 */
export function byTechLevelThenName(
  a: { techLevel?: number | 'B' | 'N'; name: string },
  b: { techLevel?: number | 'B' | 'N'; name: string }
): number {
  return techLevelRank(a.techLevel) - techLevelRank(b.techLevel) || a.name.localeCompare(b.name)
}

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
  return Array.from(levels).sort((a, b) => techLevelRank(a) - techLevelRank(b))
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
  /**
   * Named prose sections BELOW the entity's own content — currently a guide's
   * `steps`, which hold most of a guide's text (28.7k of 34.2k characters
   * across the shipped guides). Without these the no-JS/crawler rendering of a
   * guide is its title and one intro paragraph, so the pages that carry the
   * game's procedures were the ones indexing with almost no text.
   *
   * Empty for every entity that has no such sections.
   */
  sections: { name: string; paragraphs: string[] }[]
  /**
   * A roll table's outcome rows, highest roll first.
   *
   * The same defect as `sections` above, one schema over and found much later.
   * A roll-table page shipped its whole d20 table as serialized island props
   * and rendered NONE of it as markup — measured across six tables, 0 rows in
   * rendered HTML and every row inside a `<script>` tag. Without JavaScript the
   * page was its name and its source line; the table, which is the entire
   * reason the page exists, was absent from the text a crawler, a reader-mode
   * view, or an LLM following `llms.txt` receives.
   *
   * That lands on the 96 pages most likely to be opened mid-game on a bad
   * connection: "roll on Critical Damage" is the commonest thing anyone asks
   * this site for.
   *
   * `columns` tables are deliberately absent. Each of their buckets holds a
   * further 1–20 mapping, so a flat row list would misrepresent a two-roll
   * table as a one-roll one — worse than rendering nothing, because it would
   * look right. They keep the island rendering until the static path grows a
   * two-roll shape.
   *
   * Empty for every entity that is not a roll table.
   */
  table: TableRow[]
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

  // Guide STEPS — the bulk of a guide's prose. Each step becomes a named
  // section so the no-JS/crawler rendering carries the whole procedure, not
  // just the one-line intro that precedes it.
  const sections: { name: string; paragraphs: string[] }[] = []
  if ('steps' in entity && Array.isArray(entity.steps)) {
    for (const step of entity.steps) {
      if (!step || typeof step !== 'object' || typeof step.name !== 'string') continue
      const paragraphs: string[] = []
      if (Array.isArray(step.content)) {
        for (const block of step.content) {
          if (
            block &&
            typeof block === 'object' &&
            (!block.type || block.type === 'paragraph') &&
            typeof block.value === 'string'
          ) {
            paragraphs.push(block.value)
          }
        }
      }
      sections.push({ name: step.name, paragraphs })
    }
  }

  // A roll table's rows. `columns` tables are excluded on purpose — see the
  // note on `StaticEntitySummary.table`.
  const table =
    'table' in entity && entity.table && !isColumnsTable(entity.table)
      ? tableRows(entity.table)
      : []

  return {
    name,
    description,
    source,
    page,
    techLevel,
    contentParagraphs,
    stats,
    traits,
    sections,
    table,
  }
}
