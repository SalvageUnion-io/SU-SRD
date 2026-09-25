/**
 * Thrown by any model read made before its schema has been preloaded.
 *
 * A class rather than a bare `Error` so a caller can tell this — an expected
 * state in some contexts (a read-only snapshot render that never preloads, a
 * unit test) — apart from a genuine fault. Before it existed, every consumer
 * that tolerated the not-loaded case did so with a bare `catch {}`, which
 * swallowed every OTHER error in the same block too (audit AP-15).
 */
export class SchemaNotLoadedError extends Error {
  readonly schemaId: string

  constructor(schemaId: string) {
    super(
      `Schema "${schemaId}" not loaded. Call SalvageUnionReference.preload(['${schemaId}']) or SalvageUnionReference.preload('all') first.`
    )
    this.name = 'SchemaNotLoadedError'
    this.schemaId = schemaId
  }
}
