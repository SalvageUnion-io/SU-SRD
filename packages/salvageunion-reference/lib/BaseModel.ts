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
 * Performance: schemaName is stamped on each entity at construction time
 * and an ID map is built for O(1) lookups via getById().
 */
export class BaseModel<T> {
  protected data: (T & { schemaName: string })[]
  protected idMap: Map<string, T & { schemaName: string }>
  schema: Record<string, unknown>
  protected _schemaName: string
  protected _displayName: string

  constructor(data: T[], schema: Record<string, unknown>, schemaName: string, displayName: string) {
    this.schema = schema
    this._schemaName = schemaName
    this._displayName = displayName

    // Pre-stamp schemaName on each entity and build ID map
    this.idMap = new Map()
    this.data = data.map((item) => {
      const stamped = item as T & { schemaName: string }
      ;(stamped as Record<string, unknown>).schemaName = schemaName
      if (typeof item === 'object' && item !== null && 'id' in item) {
        this.idMap.set((item as Record<string, unknown>).id as string, stamped)
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
}
