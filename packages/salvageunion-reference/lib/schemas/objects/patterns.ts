/**
 * Mech patterns — a preset loadout for a chassis, plus the system/module and
 * drone configuration entries a pattern is built from.
 */

import { z } from '../../zod'
import { NameSchema, NonNegativeIntegerSchema, PositiveIntegerSchema } from '../common'
import { SourceSchema } from '../enums'
import { ContentSchema } from './content'
import { AdditionalSourceSchema } from './sources'

/**
 * Pattern system/module configuration
 */
export const PatternSystemModuleSchema = z
  .object({
    name: NameSchema.describe('Name of the system or module'),
    count: NonNegativeIntegerSchema.describe(
      'Number of this system/module in the pattern'
    ).optional(),
    preselectedChoices: z
      .record(z.string(), NameSchema)
      .describe('Preselected choices for this system or module, keyed by choice ID')
      .optional(),
    head: NameSchema.describe(
      "The chassis head this system or module is mounted on (one of its chassis's `heads`); absent means the chassis itself"
    ).optional(),
  })
  .strict()
  .describe('System or module configuration within a pattern')

/**
 * Named drone configuration for patterns with multiple drones
 */
export const PatternDroneConfigSchema = z
  .object({
    name: NameSchema.describe('Name of this drone configuration'),
    /**
     * The `drones` entry this configuration instantiates. Absent means `name`
     * IS the stat block (Little Sestra's "Sestra Drone"); present means `name`
     * is an INSTANCE name over a shared stat block — Big Brother's DronTek
     * pattern fields four differently-kitted "Big Brother Drone"s called Shield
     * Drone, Anti-Missile Drone, Fire Support Drone and Minelayer Drone, none
     * of which exist as their own `drones` records.
     */
    ref: z
      .string()
      .optional()
      .describe('Name of the drones entry this configuration instantiates (defaults to `name`)'),
    systems: z.array(z.string()).describe('System names installed on this drone'),
    modules: z.array(z.string()).describe('Module names installed on this drone'),
  })
  .strict()
  .describe('Named drone configuration for patterns with multiple drones')

/**
 * Pattern schema. The `z.lazy()` is kept — it defers building the shape to
 * first use, exactly as before the objects split (when it was load-bearing for
 * a forward reference to `AdditionalSourceSchema`, now an ordinary import).
 * Removing it would change module-evaluation order for no benefit. The type is
 * inferred, never hand-annotated — see ContentBlockSchema for why.
 */
export const PatternSchema = z
  .lazy(() =>
    z
      .object({
        name: NameSchema.describe('Name of this mech pattern'),
        content: ContentSchema.describe('Descriptive content for this pattern').optional(),
        legalStarting: z.boolean().describe('Whether this is a valid starting pattern').optional(),
        hidden: z
          .boolean()
          .describe(
            'Withhold this pattern from every rendered surface while keeping the record in the dataset. A stored data tag (mirrors the legalStarting convention) — never computed from source. Independent of `homebrew`: whether a pattern is shown is a display decision, not a statement about where it came from.'
          )
          .optional(),
        homebrew: z
          .boolean()
          .describe(
            'Homebrew Pattern: community-designed, not printed in a Leyline Press book. A stored data tag (mirrors the legalStarting convention) — never computed from source. Set on every "Mech Monday" pattern.'
          )
          .optional(),
        author: NameSchema.describe(
          'Who designed this Homebrew Pattern, as its origin post credits them. Only on `homebrew` patterns.'
        ).optional(),
        origin: z
          .string()
          .url()
          .describe(
            'The post this Homebrew Pattern was published in (e.g. its Mech Monday blog post). Only on `homebrew` patterns.'
          )
          .optional(),
        source: SourceSchema.describe('Source book for this pattern').optional(),
        page: PositiveIntegerSchema.describe('Page number in the source book').optional(),
        booklet: z
          .string()
          .min(1)
          .describe(
            'Booklet code within a multi-booklet primary source (e.g. "CR", "PH", "PC", "RR", "AP" for the Salvage Union Starter Set). Omit for single-volume sources.'
          )
          .optional(),
        additionalSources: z
          .array(AdditionalSourceSchema)
          .describe('Other source books where this pattern is reprinted')
          .optional(),
        systems: z.array(PatternSystemModuleSchema).describe('Systems included in this pattern'),
        modules: z.array(PatternSystemModuleSchema).describe('Modules included in this pattern'),
        drones: z
          .array(PatternDroneConfigSchema)
          .describe('Named drone configurations for this pattern')
          .optional(),
      })
      .strict()
  )
  .describe('A preset mech loadout defining systems and modules for a chassis')

/**
 * Bio-Titan pattern — a named variant of a Bio-Titan that the book prints as
 * "uses the stats of <Bio-Titan> with the following additional special rule"
 * (Rainmaker p.80, the Hill Worm Pattern Typhon). A DELTA, not a stat block:
 * the pattern inherits its Bio-Titan's Structure Points and actions, and
 * `actions` names only what it adds — so a change to the base is never
 * restated (and never drifts) across its patterns.
 */
export const BioTitanPatternSchema = z
  .object({
    name: NameSchema.describe('Name of this Bio-Titan pattern'),
    content: ContentSchema.describe('Descriptive content for this pattern').optional(),
    hidden: z
      .boolean()
      .describe(
        'Withhold this pattern from every rendered surface while keeping the record in the dataset (the mech-pattern `hidden` convention).'
      )
      .optional(),
    source: SourceSchema.describe('Source book for this pattern').optional(),
    page: PositiveIntegerSchema.describe('Page number in the source book').optional(),
    additionalSources: z
      .array(AdditionalSourceSchema)
      .describe('Other source books where this pattern is reprinted')
      .optional(),
    actions: z
      .array(z.string())
      .min(1)
      .describe(
        'Action names this pattern ADDS to its Bio-Titan; the base Structure Points and actions are inherited'
      ),
    formerSlugs: z
      .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      .min(1)
      .describe(
        "Slugs this pattern was once published under as a row of its host's schema (ADR-043: a published slug never dies). Each resolves, and redirects, to this pattern."
      )
      .optional(),
  })
  .strict()
  .describe("A Bio-Titan variant: the base Bio-Titan's stats plus the actions it adds")
