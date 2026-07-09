import { z } from 'zod'

/**
 * deepStrip — recursively relax `.strict()` object schemas to `.strip()`
 * (unknown keys dropped, not rejected), at every nesting depth.
 *
 * Why this exists (see db/index.ts salvage-read path, ADR-002):
 * `SomeSchema.strip()` only relaxes unknown-key checking on the OUTERMOST
 * object. Zod's `.strict()`/`.strip()` are per-object-schema settings — a
 * `.strict()` sub-schema nested inside (e.g. `CargoLotSchema` inside
 * `MechSchema.cargoLots`, `InjurySchema` inside `PilotSchema.injuries`,
 * `EntityRefSchema` inside `SoftLinkSchema.from`/`to`) keeps rejecting
 * unknown keys even when the parent was `.strip()`-ed. Under PWA autoUpdate
 * version skew (an older tab reading a record a newer build wrote with one
 * extra nested field), that nested rejection fails `safeParse` for the WHOLE
 * record — not just the drifted field — so the entire pilot/mech/etc. drops
 * out of `list()`/`get()` results.
 *
 * `deepStrip` walks the schema tree (object shapes, array elements, record
 * value types, optional/nullable/default wrappers) and rebuilds every
 * `.strict()` object encountered as `.strip()`, so an unknown key at ANY
 * depth is dropped rather than failing the parse. Object-level business-rule
 * checks (`.superRefine`/`.refine` attached to a `.strict()` object, e.g.
 * CargoLotSchema's SCRAP/tl check) are preserved — only that object's
 * unknown-key policy changes. NOTE: rebuilding an array/optional/nullable/
 * record wrapper via `z.array()`/`.optional()`/`.nullable()`/`z.record()`
 * does NOT copy any check attached to the WRAPPER itself (e.g. a
 * hypothetical `z.array(X).min(1)`); only checks on nested `.strict()`
 * objects are preserved. No current schema in `src/lib/schemas/` attaches a
 * check to a wrapper, so this is dormant — but extend `relax()` to copy
 * wrapper checks too if one is ever added.
 *
 * Deliberately scoped to the READ path only: `db/index.ts` passes
 * `deepStrip(XSchema)` as `salvageSchema` (reads), while `schema` itself
 * (the strict original, unmodified) still gates every WRITE (`create`/
 * `update`/`prepareUpdate` in crud.ts) and bundle import validation
 * (`exportBundle.ts` parses with the strict schemas directly) — genuinely
 * malformed data on write/import is still rejected. `deepStrip` never
 * mutates its input; it returns a new schema instance.
 *
 * Handles the schema constructs actually used in `src/lib/schemas/`:
 * object, array, optional, nullable, default, record. Any other Zod type
 * (string, number, enum, literal, union, ...) passes through unchanged —
 * extend this switch if a future schema introduces a nested `.strict()`
 * object behind a construct not listed here (e.g. `z.union`).
 */
function relax(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>
    const relaxedShape: Record<string, z.ZodTypeAny> = {}
    let changed = false
    for (const [key, value] of Object.entries(shape)) {
      const relaxed = relax(value)
      relaxedShape[key] = relaxed
      if (relaxed !== value) changed = true
    }
    // safeExtend (not extend) — extend() throws when the schema carries
    // refinements (e.g. CargoLotSchema's SCRAP/tl superRefine) even when the
    // "new" keys are the same keys with relaxed inner schemas.
    const rebuilt = changed ? schema.safeExtend(relaxedShape) : schema
    return rebuilt.strip()
  }

  // Zod v4's accessor getters (`.element`, `.unwrap()`, `.keyType`,
  // `.valueType`) are typed against the internal "core" `$ZodType`
  // interface rather than the public "classic" `ZodType` class `relax`
  // accepts — structurally compatible at runtime, but TypeScript treats
  // them as distinct nominal types. Cast through `z.ZodTypeAny` at each
  // accessor to bridge that declaration gap.
  if (schema instanceof z.ZodArray) {
    return z.array(relax(schema.element as z.ZodTypeAny))
  }

  if (schema instanceof z.ZodOptional) {
    return relax(schema.unwrap() as z.ZodTypeAny).optional()
  }

  if (schema instanceof z.ZodNullable) {
    return relax(schema.unwrap() as z.ZodTypeAny).nullable()
  }

  if (schema instanceof z.ZodDefault) {
    return relax(schema.unwrap() as z.ZodTypeAny).default(schema._zod.def.defaultValue)
  }

  if (schema instanceof z.ZodRecord) {
    return z.record(
      relax(schema.keyType as z.ZodTypeAny) as z.ZodTypeAny as z.core.$ZodRecordKey,
      relax(schema.valueType as z.ZodTypeAny)
    )
  }

  return schema
}

/**
 * Public entry point: preserves the input's static type (`T`) at the call
 * site (e.g. `deepStrip(MechSchema)` still types as `ZodType<Mech>` for
 * inference purposes downstream), while the recursion itself runs untyped
 * over `z.ZodTypeAny` in `relax` above — Zod v4's structural generics don't
 * thread cleanly through a generic recursive call, so the type parameter is
 * only re-applied once, at the boundary.
 */
export function deepStrip<T extends z.ZodTypeAny>(schema: T): T {
  return relax(schema) as T
}
