import { z } from 'zod'
import { STARTING_ABILITY_BUDGET, STARTING_EQUIPMENT_BUDGET } from '../constants'
import { ItemConditionMapSchema } from './mech'

/**
 * Persisted choice selections for an entity that carries `choices`
 * (e.g. granted equipment with permanent/multi-select picks).
 *
 * Mirrors suref-react's `ChoiceSelections` type exactly:
 *   Record<choiceId, selectedOptionValues[]>
 * so it can be passed straight into ReferenceEntityDisplay's controlled
 * `selections` prop. Free-text choices store their value as a single-element array.
 */
export const ChoiceSelectionsSchema = z.record(z.string(), z.array(z.string()))

/**
 * classRef: slug reference to a class in salvageunion-reference.
 * Resolution against game data is handled at the presentation/query layer.
 */
export const PilotSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    /** Pilot's real name — must not be empty. */
    name: z.string().min(1),
    /** Pilot's callsign / handle — must not be empty. */
    callsign: z.string().min(1),
    /** Slug reference to a Pilot Class in salvageunion-reference */
    classRef: z.string(),
    /**
     * Slugs of class abilities selected for this pilot.
     * Capped at STARTING_ABILITY_BUDGET for character creation.
     * Reference-data maxAbilities per class is the preferred source when available.
     */
    abilities: z.array(z.string()).max(STARTING_ABILITY_BUDGET),
    /**
     * Slugs of equipment items carried.
     * Capped at STARTING_EQUIPMENT_BUDGET for character creation.
     */
    equipment: z.array(z.string()).max(STARTING_EQUIPMENT_BUDGET),
    /** Freeform roll result strings (injury table, etc.) */
    rollResults: z.array(z.string()),
    motto: z.string(),
    keepsake: z.string(),
    appearance: z.string(),
    background: z.string().default(''),
    /** Active condition slugs */
    conditions: z.array(z.string()),
    /** Optional: links this pilot to a workspace */
    workspaceId: z.string().optional(),
    // ---------------------------------------------------------------------------
    // Live-play current stat tracking (#245).
    // These are current values for the active session — separate from any
    // class/rules defaults. When absent the sheet falls back to 0.
    // TODO: source base value from rules once pilot class data exposes HP/AP.
    // ---------------------------------------------------------------------------
    /** Current hit points */
    currentHP: z.number().int().min(0).optional(),
    /** Current action points */
    currentAP: z.number().int().min(0).optional(),
    /**
     * Per-equipment condition map (REQ-011 #240). Keyed by equipment slug.
     * When absent or key missing, the display layer defaults to 'intact'.
     */
    equipmentConditions: ItemConditionMapSchema.optional(),
    /**
     * Persisted granted-equipment choice selections, keyed by equipment slug,
     * then by choiceId → selected option values. Optional: when absent or a key
     * is missing, the display layer treats that item as having no selections.
     * Additive optional field — no DB migration needed (same tactic as
     * equipmentConditions).
     */
    equipmentChoices: z.record(z.string(), ChoiceSelectionsSchema).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Pilot = z.infer<typeof PilotSchema>
