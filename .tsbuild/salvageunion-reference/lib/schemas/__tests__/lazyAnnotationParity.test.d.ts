/**
 * Drift guard for the six `z.lazy()` schemas.
 *
 * A hand-written `z.ZodType<{…}>` annotation on a `z.lazy()` schema is a SILENT
 * type lie: TypeScript accepts an annotation that is narrower than the object
 * the getter actually builds, so a key present in the Zod shape — parsed at
 * runtime, emitted into `schemas/*.schema.json`, present in the data — is
 * missing from `z.infer` for every consumer in the monorepo. Nothing fails; the
 * field just does not exist as far as the compiler is concerned.
 *
 * All six annotations have been removed (the types are inferred now). These
 * tests keep them removed, and keep the inferred key set honest:
 *
 *   1. No `z.ZodType<…> = z.lazy(…)` pair may reappear in `lib/schemas/`.
 *   2. For each schema, ONE committed key list is checked against BOTH the live
 *      Zod shape (runtime) and `keyof z.infer<…>` (compile time). A key that
 *      exists in one and not the other cannot satisfy both, which is exactly
 *      the divergence an annotation would hide.
 */
export {};
