/**
 * Effects (ADR-029): the TRAIT/DAMAGE/RANGE half of the converged "what does
 * this record change" model, applied at dataview time by `resolveChoiceView`.
 * The numeric half lives in `contributions.ts`.
 */

import { z } from '../../zod.js'

/**
 * Whose state an effect changes (ADR-029).
 *
 * `self` — the record declaring it — was the only target the model had, and THAT
 * was the blocker, not the declaration site. Bio-Wings says "YOUR MECH gains the
 * Fly Trait": declared as a self-effect it would say the Bio-Wings *system*
 * flies, which is wrong rather than merely incomplete.
 */
export const EffectTargetSchema = z
  .enum(['self', 'hostMech'])
  .describe('Whose state an effect changes — the declaring record, or the mech hosting it')

/**
 * A single mechanical effect of a choice option, discriminated by `op` so each
 * operation only permits the fields it actually uses (no `removeTrait` with an
 * `amount`, no `addDamage` with an `amount`, etc.):
 *
 * - `addTrait`    — add a trait by name; optional `amount` is its magnitude
 *                   (e.g. Burn 1). Adding a trait that already exists upgrades it.
 * - `removeTrait` — strip a trait by name.
 * - `setRange`    — replace the Range datavalue.
 * - `addDamage`   — increase the Damage datavalue; optional `unit` (e.g. "SP").
 */
export const ChoiceEffectSchema = z
  .discriminatedUnion('op', [
    z
      .object({
        op: z.literal('addTrait'),
        value: z.string(),
        amount: z.union([z.string(), z.number()]).optional(),
        target: EffectTargetSchema.describe('Defaults to `self` when absent').optional(),
      })
      .strict(),
    z
      .object({
        op: z.literal('removeTrait'),
        value: z.string(),
        target: EffectTargetSchema.describe('Defaults to `self` when absent').optional(),
      })
      .strict(),
    z
      .object({
        op: z.literal('setRange'),
        value: z.union([z.string(), z.number()]),
      })
      .strict(),
    z
      .object({
        op: z.literal('addDamage'),
        value: z.union([z.string(), z.number()]),
        unit: z.string().optional(),
      })
      .strict(),
  ])
  .describe('A single mechanical effect applied when a choice option is selected')
