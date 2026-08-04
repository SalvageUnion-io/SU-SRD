/**
 * Contributions (ADR-029): the NUMERIC half of the converged "what does this
 * record change" model — a flat mechanical change to a named stat on a named
 * target. The trait/damage/range half lives in `effects.ts`.
 */

import { z } from '../../zod.js'

/**
 * The stats a contribution may raise or lower (ADR-029).
 *
 * A superset of the four mech core maxima: an ability can change a
 * PILOT stat (Bionic Legs "+2 Max HP", Beefcake "+4 Inventory Capacity") or a
 * slot COUNT (Modular Face Implant "your Pilot gains a Module Slot"), neither of
 * which the mech-only shape could express.
 */
export const ContributionStatSchema = z
  .enum([
    // mech
    'structurePoints',
    'energyPoints',
    'heatCapacity',
    'cargoCapacity',
    'systemSlots',
    'moduleSlots',
    // pilot
    'maxHp',
    'maxAp',
    'inventorySlots',
  ])
  .describe('The mech, pilot or slot-count stat a contribution raises or lowers')

/**
 * Whose stat a contribution changes.
 *
 * `self` is the host the contribution is declared on (a system contributing to
 * its own mech). The others exist because Beefcake is a PILOT ability that
 * raises the piloted MECH's Max SP and Cargo while also raising the pilot's own
 * Max HP and Inventory — one record, two targets, which no single-target shape
 * could express.
 */
export const ContributionTargetSchema = z
  .enum(['self', 'pilot', 'pilotedMech', 'crawler'])
  .describe('Whose stat a contribution changes — the declaring host, or a related entity')

/**
 * How much a contribution is worth.
 *
 * A plain integer covers most records. `perTechLevel` exists for Beefcake —
 * "increases its Max Structure Points by 3+X (where X is the Mech's Tech
 * Level)" — where the amount is `flat + perTechLevel × techLevel`. Rendering the
 * amount needs the target's tech level, so a consumer that cannot supply one
 * resolves `perTechLevel` to 0 rather than guessing.
 */
export const ContributionAmountSchema = z
  .union([
    z.number().int(),
    z
      .object({
        flat: z.number().int().describe('The constant part').optional(),
        perTechLevel: z.number().int().describe("Multiplied by the target's tech level"),
      })
      .strict(),
    z
      .object({
        /**
         * The amount IS another of the target's stats. Hull Magnetiser increases
         * Cargo Capacity "by its System Slot Value" — a number that changes with
         * the chassis, so it cannot be written as a constant.
         */
        fromStat: ContributionStatSchema,
      })
      .strict(),
  ])
  .describe(
    'How much a contribution is worth: a flat integer, a per-tech-level formula, or another of the target stats'
  )

/**
 * A single mechanical contribution a piece of content makes to a stat
 * (ADR-029).
 *
 * This is the numeric half of the converged model. The trait/damage/range half
 * already exists as `ChoiceEffectSchema` and is applied by `resolveChoiceView`;
 * the two are declared side by side rather than merged into one union, because
 * they are resolved at different layers — stats at derivation time, effects at
 * dataview time.
 *
 * **Never infer a contribution from prose.** Populate it only where the rules
 * text states a flat mechanical change; anything conditional, prose-only, or
 * duration-bound stays undeclared and is answered to the parity audit with an
 * explicit exemption instead.
 */
export const ContributionSchema = z
  .object({
    stat: ContributionStatSchema,
    amount: ContributionAmountSchema,
    target: ContributionTargetSchema.describe('Defaults to `self` when absent').optional(),
    stacks: z
      .boolean()
      .describe('Applies once per installed copy (default true for installable items)')
      .optional(),
    voidWhen: z
      .enum(['damaged', 'destroyed'])
      .describe('Condition at which this contribution stops applying')
      .optional(),
    duration: z
      .enum(['permanent', 'activated'])
      .describe(
        'Permanent (default) applies whenever held/installed. `activated` applies ' +
          'only while the player has switched it on in Guided Play — ephemeral ' +
          'play state (ADR-019), never persisted on the entity.'
      )
      .optional(),
    note: z.string().describe('Why this is encoded the way it is').optional(),
  })
  .strict()
  .describe('A flat mechanical contribution this content makes to a stat')
