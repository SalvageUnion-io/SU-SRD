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
 */
export class BaseModel<T> {
  protected data: T[]
  protected schema: Record<string, unknown>
  protected _schemaName: string
  protected _displayName: string

  constructor(data: T[], schema: Record<string, unknown>, schemaName: string, displayName: string) {
    this.data = data
    this.schema = schema
    this._schemaName = schemaName
    this._displayName = displayName
  }

  /**
   * Add schemaName to an entity
   * Creates a new object with schemaName added (doesn't mutate original)
   */
  protected addSchemaName(entity: T): T & { schemaName: string } {
    if (!entity || typeof entity !== 'object') {
      return entity as T & { schemaName: string }
    }
    // If schemaName already exists, return as-is
    if (
      'schemaName' in entity &&
      (entity as { schemaName?: string }).schemaName === this._schemaName
    ) {
      return entity as T & { schemaName: string }
    }
    // Create a new object with schemaName added
    return { ...entity, schemaName: this._schemaName } as T & { schemaName: string }
  }

  /**
   * Get all items (with schemaName added)
   */
  all(): (T & { schemaName: string })[] {
    return this.data.map((item) => this.addSchemaName(item))
  }

  /**
   * Find a single item by predicate (same interface as Array.find)
   * Returns item with schemaName added
   */
  find(predicate: (item: T) => boolean): (T & { schemaName: string }) | undefined {
    const found = this.data.find(predicate)
    return found ? this.addSchemaName(found) : undefined
  }

  /**
   * Find all items matching predicate (same interface as Array.filter)
   * Returns items with schemaName added
   */
  findAll(predicate: (item: T) => boolean): (T & { schemaName: string })[] {
    return this.data.filter(predicate).map((item) => this.addSchemaName(item))
  }
}
