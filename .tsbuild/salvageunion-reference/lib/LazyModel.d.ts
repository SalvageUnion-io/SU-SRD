import { BaseModel } from './BaseModel';
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
export declare class LazyModel<T> extends BaseModel<T> {
    private readonly _schemaIdForLazy;
    private _backing;
    readonly schemaName: string;
    readonly displayName: string;
    constructor(schemaId: string, _propName: string, displayNameValue: string);
    /**
     * Install the real backing model once preload() has resolved.
     * Called by SalvageUnionReference.preload() after loading completes.
     */
    _install(backing: BaseModel<T>): void;
    /**
     * Reset to the pre-load state (testing only). Clears the backing model so
     * subsequent data access throws again. Owning the private
     * `_backing` field here lets resetAllForTesting() avoid an `as unknown as`
     * reach-in to poke the private field from outside the class.
     */
    _reset(): void;
    private _loadedBacking;
    all(): (T & {
        schemaName: string;
    })[];
    find(predicate: (item: T) => boolean): (T & {
        schemaName: string;
    }) | undefined;
    findAll(predicate: (item: T) => boolean): (T & {
        schemaName: string;
    })[];
    getById(id: string): (T & {
        schemaName: string;
    }) | undefined;
    getByName(name: string): (T & {
        schemaName: string;
    }) | undefined;
    getBySlug(slug: string): (T & {
        schemaName: string;
    }) | undefined;
}
