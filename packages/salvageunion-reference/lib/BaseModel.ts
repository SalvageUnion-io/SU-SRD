import { nameToSlug } from './nameToSlug.js'

/**
 * Type for models with metadata properties
 */
export type ModelWithMetadata<T> = BaseModel<T> & {
  readonly schemaName: string
  readonly displayName: string
}

/**
 * Simplified Base Model class for querying JSON data with type safety
 * Provides only the essential query methods
 *
 * Performance: schemaName is stamped on each entity at construction time and an
 * ID map is built for O(1) `getById()`. `name` and `slug` are indexed too, but
 * LAZILY — the id map serves one caller (`SalvageUnionReference.get`) while name
 * and slug are how nearly every consumer actually addresses an entity, and a
 * model that is never looked up by name should not pay to slugify every row.
 * Reference data is immutable after load, so each map is built once on first use.
 */
export class BaseModel<T> {
  protected data: (T & { schemaName: string })[]
  protected idMap: Map<string, T & { schemaName: string }>
  protected nameMap: Map<string, T & { schemaName: string }> | null = null
  protected slugMap: Map<string, T & { schemaName: string }> | null = null
  protected _schemaName: string
  protected _displayName: string

  constructor(data: T[], schemaName: string, displayName: string) {
    this._schemaName = schemaName
    this._displayName = displayName

    // Pre-stamp schemaName on each entity and build ID map
    this.idMap = new Map()
    this.data = data.map((item) => {
      // Sole assertion (the JSON-ingest edge): raw data rows are T; stamping
      // adds the runtime schemaName discriminant the static type can't carry.
      const stamped = item as T & { schemaName: string }
      stamped.schemaName = schemaName
      if (
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        typeof item.id === 'string'
      ) {
        this.idMap.set(item.id, stamped)
      }
      return stamped
    })
  }

  /**
   * Get all items (schemaName already stamped)
   */
  all(): (T & { schemaName: string })[] {
    return this.data
  }

  /**
   * Find a single item by predicate (same interface as Array.find)
   */
  find(predicate: (item: T) => boolean): (T & { schemaName: string }) | undefined {
    return this.data.find(predicate)
  }

  /**
   * Find all items matching predicate (same interface as Array.filter)
   */
  findAll(predicate: (item: T) => boolean): (T & { schemaName: string })[] {
    return this.data.filter(predicate)
  }

  /**
   * Get an entity by ID in O(1) time
   */
  getById(id: string): (T & { schemaName: string }) | undefined {
    return this.idMap.get(id)
  }

  /**
   * Get an entity by exact `name` in O(1) time.
   *
   * Exactly equivalent to `find((e) => e.name === name)`: rows whose `name` is
   * absent or not a string are not indexed, and on a duplicate name the FIRST
   * row in data order wins — the same answer `Array.prototype.find` gives.
   */
  getByName(name: string): (T & { schemaName: string }) | undefined {
    if (!this.nameMap) {
      this.nameMap = this.buildKeyIndex((rowName) => rowName)
    }
    return this.nameMap.get(name)
  }

  /**
   * Get an entity by the slug derived from its `name`, in O(1) time.
   *
   * Exactly equivalent to `find((e) => nameToSlug(e.name) === slug)`, with the
   * same first-writer-wins collision rule as {@link getByName}.
   */
  getBySlug(slug: string): (T & { schemaName: string }) | undefined {
    if (!this.slugMap) {
      // An empty `name` is not slug-addressable — the linear scan this replaces
      // tested `!item.name` and skipped such rows, so indexing them would let a
      // nameless row claim the `''` slug key it never used to answer for.
      this.slugMap = this.buildKeyIndex((rowName) => (rowName === '' ? null : nameToSlug(rowName)))
    }
    return this.slugMap.get(slug)
  }

  /**
   * Index every row carrying a string `name` under `key(name)`, skipping rows
   * for which `key` returns null. First writer wins, matching
   * `Array.prototype.find` order.
   */
  private buildKeyIndex(
    key: (name: string) => string | null
  ): Map<string, T & { schemaName: string }> {
    const map = new Map<string, T & { schemaName: string }>()
    for (const item of this.data) {
      if (typeof item !== 'object' || item === null) continue
      if (!('name' in item)) continue
      const name = (item as { name?: unknown }).name
      if (typeof name !== 'string') continue
      const mapKey = key(name)
      if (mapKey === null) continue
      if (!map.has(mapKey)) map.set(mapKey, item)
    }
    return map
  }
}
