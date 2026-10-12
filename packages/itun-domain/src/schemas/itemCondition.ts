/**
 * Per-item condition states for mech systems, modules, pilot equipment, and
 * partner loadouts. Keyed by the item slug; absent defaults to 'intact' at the
 * display layer.
 *
 * These lived in `mech.ts` and were pulled out when partners arrived. `mech.ts`
 * now imports `partner.ts` (a mech owns partners) while `partner.ts` needs the
 * condition map — routing that through `mech.ts` would make the two modules
 * mutually importing. A Zod schema is a runtime value, not just a type, so an
 * import cycle here is not benign: whichever module the bundler enters second
 * sees a partially-initialised namespace and reads `undefined` where it expects
 * a schema. A leaf module both can depend on removes the cycle by construction.
 *
 * `mech.ts` re-exports all four names, so existing importers are unaffected.
 */

import { z } from 'salvageunion-reference/zod'

export const ItemConditionSchema = z.enum(['intact', 'damaged', 'destroyed'])

export type ItemCondition = z.infer<typeof ItemConditionSchema>

/** Map from item slug → condition */
export const ItemConditionMapSchema = z.record(z.string(), ItemConditionSchema)

/**
 * @knipignore Knip false positive: `lib/rules/downtime.ts` imports this type and
 * deleting it fails typecheck (TS2724), but knip does not credit that import.
 */
export type ItemConditionMap = z.infer<typeof ItemConditionMapSchema>
