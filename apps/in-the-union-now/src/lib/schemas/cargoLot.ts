import { z } from 'zod'

/**
 * CargoLot — the unified cargo model shared by mechs, mech patterns, and
 * crawlers (design §2.12, plan 2.3).
 *
 * Shape: `{ id, kind: 'bulk' | 'unit', name, cat, tl?, qty?, units, code }`
 *   - `kind: 'bulk'`  — arbitrary ×N quantity, splittable when moved (qty set).
 *   - `kind: 'unit'`  — atomic entity, moves whole-or-not (qty absent).
 *   - `units`         — total cargo-slot cost of the lot (bulk: per the whole lot).
 *   - `cat`           — display/economy category. SCRAP lots MUST carry `tl`
 *                       (1–6) so scrap can deposit/withdraw the matching
 *                       crawler scrap-pool bucket when crossing the crawler
 *                       boundary.
 *   - `code`          — short display code rendered on cargo chits ('CAT · CODE').
 */
export const CargoLotCategorySchema = z.enum(['SCRAP', 'POWER', 'SEALED', 'SYSTEM'])
export type CargoLotCategory = z.infer<typeof CargoLotCategorySchema>

export const CargoLotSchema = z
  .object({
    id: z.string(),
    kind: z.enum(['bulk', 'unit']),
    name: z.string().min(1),
    cat: CargoLotCategorySchema,
    /** Scrap tech level (1–6). Required when cat === 'SCRAP'. */
    tl: z.number().int().min(1).max(6).optional(),
    /** Bulk quantity (×N). Only meaningful on kind === 'bulk'. */
    qty: z.number().int().min(0).optional(),
    /** Cargo-slot cost of the whole lot. */
    units: z.number().int().min(0),
    /** Short display code for cargo chits. */
    code: z.string(),
  })
  .strict()
  .superRefine((lot, ctx) => {
    if (lot.cat === 'SCRAP' && lot.tl === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SCRAP cargo lots must carry a tech level (tl)',
        path: ['tl'],
      })
    }
  })

export type CargoLot = z.infer<typeof CargoLotSchema>

/** Derive a short chit code from a lot name, e.g. "Salvaged plating" → "SAL". */
function codeFromName(name: string): string {
  const letters = name
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase()
  return letters.length > 0 ? letters : 'LOT'
}

/**
 * Build a single-unit (atomic) cargo lot from a free-text name.
 * Used by the mech builder's custom-cargo entries and by the legacy-cargo
 * conversion path. `units` defaults to 1 slot — the historical accounting for
 * string cargo entries.
 */
export function makeUnitLot(
  name: string,
  options: { cat?: CargoLotCategory; units?: number; tl?: number } = {}
): CargoLot {
  const { cat = 'SEALED', units = 1, tl } = options
  return {
    id: crypto.randomUUID(),
    kind: 'unit',
    name,
    cat,
    ...(tl !== undefined ? { tl } : {}),
    units,
    code: codeFromName(name),
  }
}

/** Build a bulk SCRAP lot of `qty` scrap at tech level `tl` (1 slot per scrap on a mech). */
export function makeScrapLot(tl: number, qty: number): CargoLot {
  return {
    id: crypto.randomUUID(),
    kind: 'bulk',
    name: `Tech ${tl} Scrap`,
    cat: 'SCRAP',
    tl,
    qty,
    units: qty,
    code: `SCR-T${tl}`,
  }
}

/** Total cargo-slot usage across a list of lots. */
export function totalLotUnits(lots: ReadonlyArray<Pick<CargoLot, 'units'>>): number {
  return lots.reduce((sum, lot) => sum + lot.units, 0)
}

/**
 * Convert a legacy `cargo: string[]` value to `cargoLots`.
 * Each legacy string becomes a 1-unit SEALED unit-lot — faithful to how legacy
 * entries were counted (1 slot each, no category/TL metadata existed).
 */
export function cargoLotsFromLegacyCargo(cargo: ReadonlyArray<string>): CargoLot[] {
  return cargo.map((name) => makeUnitLot(name))
}

/**
 * Normalize a raw mech/pattern record that may carry the legacy `cargo`
 * string-array field: converts it to `cargoLots` and drops `cargo`.
 * Shared by the v3 IndexedDB migration and parseImportBundle (old export
 * bundles predate the rename). Records without legacy `cargo` pass through
 * untouched.
 */
export function normalizeLegacyCargoRecord(
  record: Record<string, unknown>
): Record<string, unknown> {
  if (!Array.isArray(record['cargo'])) return record
  const { cargo, ...rest } = record
  const legacy = (cargo as unknown[]).map((entry) => String(entry))
  return {
    ...rest,
    cargoLots: Array.isArray(rest['cargoLots'])
      ? rest['cargoLots']
      : cargoLotsFromLegacyCargo(legacy),
  }
}
