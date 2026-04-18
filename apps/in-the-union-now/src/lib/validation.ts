import { z } from 'zod'
import type { Json } from '../types/database-generated.types'

/**
 * Zod row schemas for Supabase tables.
 *
 * These mirror the generated DB Row types from
 * `src/types/database-generated.types.ts` and are used with
 * `parseDatabaseResult` to enforce the DB → TS boundary at runtime.
 *
 * Keep these in sync with the generated types. If the DB schema drifts,
 * Zod will throw at the API boundary rather than letting a silent
 * `as unknown as T` cast propagate a malformed row downstream.
 */

// `Json` mirror of the generated Json type — used for `session_state` and
// similar jsonb columns whose internal shape we validate elsewhere.
// Typed as `ZodType<Json>` so `z.infer` aligns with the DB-generated Json.
const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ])
)

export const CampaignRowSchema = z.object({
  archived: z.boolean(),
  crawler_id: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string(),
  id: z.string(),
  invite_code: z.string().nullable(),
  name: z.string(),
  session_state: jsonSchema.nullable(),
  updated_at: z.string(),
})

export const CampaignMemberRowSchema = z.object({
  campaign_id: z.string(),
  id: z.string(),
  joined_at: z.string(),
  role: z.string(),
  user_id: z.string(),
})

// Enum mirrors of the Postgres enums in database-generated.types.ts.
const itemConditionSchema = z.enum(['intact', 'damaged', 'destroyed'])
const parentTypeSchema = z.enum(['pilot', 'mech', 'crawler'])

export const PilotRowSchema = z.object({
  active: z.boolean(),
  ap: z.number(),
  appearance: z.string().nullable(),
  background: z.string().nullable(),
  background_used: z.boolean().nullable(),
  callsign: z.string(),
  class_ref: z.string(),
  crawler_id: z.string().nullable(),
  created_at: z.string(),
  hp: z.number(),
  id: z.string(),
  image_path: z.string().nullable(),
  in_downtime: z.boolean(),
  injuries: jsonSchema,
  is_boarded: z.boolean(),
  keepsake: z.string().nullable(),
  keepsake_used: z.boolean().nullable(),
  max_ap: z.number(),
  max_hp: z.number(),
  mech_id: z.string().nullable(),
  motto: z.string().nullable(),
  motto_used: z.boolean().nullable(),
  notes: z.string().nullable(),
  tp: z.number(),
  updated_at: z.string(),
  user_id: z.string(),
  visible: z.boolean(),
})

export const MechRowSchema = z.object({
  active: z.boolean(),
  cargo_capacity: z.number(),
  chassis_ref: z.string(),
  created_at: z.string(),
  current_ep: z.number(),
  current_heat: z.number(),
  current_sp: z.number(),
  heat_capacity: z.number(),
  id: z.string(),
  image_path: z.string().nullable(),
  max_ep: z.number(),
  max_sp: z.number(),
  notes: z.string().nullable(),
  pattern_name: z.string().nullable(),
  source_pattern_id: z.string().nullable(),
  source_ref_pattern_id: z.string().nullable(),
  updated_at: z.string(),
  user_id: z.string(),
})

export const CrawlerRowSchema = z.object({
  active: z.boolean(),
  bay_npcs: jsonSchema,
  crawler_ref: z.string(),
  created_at: z.string(),
  current_sp: z.number(),
  id: z.string(),
  max_sp: z.number(),
  name: z.string().nullable(),
  notes: z.string().nullable(),
  scrap_tl1: z.number(),
  scrap_tl2: z.number(),
  scrap_tl3: z.number(),
  scrap_tl4: z.number(),
  scrap_tl5: z.number(),
  scrap_tl6: z.number(),
  tag: z.string().nullable(),
  tech_level: z.number(),
  updated_at: z.string(),
  upgrade_pool: z.number(),
  upkeep: z.number(),
  user_id: z.string(),
  visible: z.boolean(),
})

export const EntityRefRowSchema = z.object({
  condition: itemConditionSchema,
  created_at: z.string(),
  id: z.string(),
  metadata: jsonSchema.nullable(),
  parent_id: z.string(),
  parent_type: parentTypeSchema,
  schema_name: z.string(),
  schema_ref_id: z.string(),
  sort_order: z.number(),
  updated_at: z.string(),
  user_id: z.string(),
})

export const DowntimeRecordRowSchema = z.object({
  closed_at: z.string().nullable(),
  craft_receipts: jsonSchema.nullable(),
  crawler_id: z.string(),
  created_at: z.string(),
  customise_acknowledged: jsonSchema.nullable(),
  deterioration_pending: jsonSchema.nullable(),
  equipment_receipts: jsonSchema.nullable(),
  id: z.string(),
  offload_receipts: jsonSchema,
  pre_session_started: z.boolean(),
  restore_receipts: jsonSchema,
  rumour_receipts: jsonSchema.nullable(),
  trade_result: jsonSchema.nullable(),
  trade_roll_key: z.string().nullable(),
  trade_roll_value: z.number().nullable(),
  training_receipts: jsonSchema.nullable(),
  upkeep_paid: z.boolean(),
  upkeep_result: jsonSchema.nullable(),
  user_id: z.string(),
})
