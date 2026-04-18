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
