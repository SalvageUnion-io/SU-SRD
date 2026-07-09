import { BaseModel } from './BaseModel.js'

/**
 * A BaseModel subclass that guards all data-access methods behind a load
 * check. Before preload(), all data methods throw. After preload(), they
 * delegate to the real backing model.
 *
 * The backing model is replaced in place so that references captured before
 * preload (e.g. `const c = SalvageUnionReference.Chassis`) see the real data
 * after preload completes.
 *
 * Extracted to its own module (rather than living in lib/index.ts) so that
 * the generated lib/generated/schemaRegistry.generated.ts — which
 * instantiates one LazyModel per schema — can import it without creating a
 * circular import with lib/index.ts.
 */
export class LazyModel<T> extends BaseModel<T> {
  private readonly _schemaIdForLazy: string
  private _backing: BaseModel<T> | null = null

  // Declared explicitly so TypeScript sees them as class properties
  // (ModelWithMetadata<T> requires these to be present).
  readonly schemaName: string
  readonly displayName: string

  constructor(schemaId: string, _propName: string, displayNameValue: string) {
    // Pass empty arrays / empty schema; data is never used until _backing is set
    super([], {}, schemaId, displayNameValue)
    this._schemaIdForLazy = schemaId
    this.schemaName = schemaId
    this.displayName = displayNameValue
  }

  /**
   * Install the real backing model once preload() has resolved.
   * Called by SalvageUnionReference.preload() after loading completes.
   */
  _install(backing: BaseModel<T>): void {
    this._backing = backing
    // Copy the schema reference so getDataMaps() can read it
    this.schema = backing.schema
  }

  /**
   * Reset to the pre-load state (testing only). Clears the backing model and
   * schema so subsequent data access throws again. Owning the private
   * `_backing` field here lets resetAllForTesting() avoid an `as unknown as`
   * reach-in to poke the private field from outside the class.
   */
  _reset(): void {
    this._backing = null
    this.schema = {}
  }

  private _assertLoaded(): void {
    if (!this._backing) {
      throw new Error(
        `Schema "${this._schemaIdForLazy}" not loaded. Call SalvageUnionReference.preload(['${this._schemaIdForLazy}']) or SalvageUnionReference.preload('all') first.`
      )
    }
  }

  all(): (T & { schemaName: string })[] {
    this._assertLoaded()
    return this._backing!.all()
  }

  find(predicate: (item: T) => boolean): (T & { schemaName: string }) | undefined {
    this._assertLoaded()
    return this._backing!.find(predicate)
  }

  findAll(predicate: (item: T) => boolean): (T & { schemaName: string })[] {
    this._assertLoaded()
    return this._backing!.findAll(predicate)
  }

  getById(id: string): (T & { schemaName: string }) | undefined {
    this._assertLoaded()
    return this._backing!.getById(id)
  }
}
