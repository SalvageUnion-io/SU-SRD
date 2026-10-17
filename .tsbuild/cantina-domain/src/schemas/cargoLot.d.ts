import { z } from 'salvageunion-reference/zod';
/**
 * CargoLot — the unified cargo model shared by mechs, mech patterns, and
 * crawlers.
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
declare const CargoLotCategorySchema: z.ZodEnum<{
    POWER: "POWER";
    SCRAP: "SCRAP";
    SEALED: "SEALED";
    SYSTEM: "SYSTEM";
}>;
export type CargoLotCategory = z.infer<typeof CargoLotCategorySchema>;
export declare const CargoLotSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        bulk: "bulk";
        unit: "unit";
    }>;
    name: z.ZodString;
    cat: z.ZodEnum<{
        POWER: "POWER";
        SCRAP: "SCRAP";
        SEALED: "SEALED";
        SYSTEM: "SYSTEM";
    }>;
    tl: z.ZodOptional<z.ZodNumber>;
    qty: z.ZodOptional<z.ZodNumber>;
    units: z.ZodNumber;
    code: z.ZodString;
}, z.core.$strict>;
export type CargoLot = z.infer<typeof CargoLotSchema>;
/**
 * Build a single-unit (atomic) cargo lot from a free-text name. `units`
 * defaults to 1 slot.
 */
export declare function makeUnitLot(name: string, options?: {
    cat?: CargoLotCategory;
    units?: number;
    tl?: number;
}): CargoLot;
/** Build a bulk SCRAP lot of `qty` scrap at tech level `tl` (1 slot per scrap on a mech). */
export declare function makeScrapLot(tl: number, qty: number): CargoLot;
/** Total cargo-slot usage across a list of lots. */
export declare function totalLotUnits(lots: ReadonlyArray<Pick<CargoLot, 'units'>>): number;
export {};
