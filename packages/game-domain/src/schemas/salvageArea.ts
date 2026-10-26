import { z } from 'salvageunion-reference/zod'

/**
 * The area the crew is salvaging (Core Book p.245): a place the Mediator says
 * can be Area Salvaged, with the Tech Level of what is found there and its
 * Supply, how many rolls it has left. Each Area Salvage roll spends 1 Supply;
 * at 0 the area is picked clean. One per table: a Game's, set by its Mediator,
 * or a solo player's own (`rooms/account/soloArea.ts`).
 */

/** The Supply an area starts with unless the Mediator says otherwise (p.245). */
export const DEFAULT_AREA_SUPPLY = 5

/** The most Supply an area may be given: a generous ceiling, not a rule. */
export const MAX_AREA_SUPPLY = 99

export const SalvageAreaSchema = z
  .object({
    /** What the table calls it ("Raider Camp"); may be empty. */
    name: z.string().max(60),
    techLevel: z.number().int().min(1).max(6),
    supply: z.number().int().min(0).max(MAX_AREA_SUPPLY),
  })
  .strict()

export type SalvageArea = z.infer<typeof SalvageAreaSchema>
