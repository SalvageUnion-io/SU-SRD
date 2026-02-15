import { z } from 'zod'

// Shared validation helpers
export const uuid = z.string().uuid()
export const jsonValue: z.ZodType = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(jsonValue), z.array(jsonValue)])
)
export const jsonObject = z.record(jsonValue)

// Pattern builder schemas
export const patternItemSchema = z.object({
  schema_name: z.enum(['systems', 'modules']),
  schema_ref_id: z.string().min(1),
  sort_order: z.number().int().nonnegative(),
})

export const createPatternSchema = z.object({
  name: z.string().min(1, 'Pattern name is required').max(100),
  chassis_ref: z.string().min(1),
  pattern_items: z.array(patternItemSchema),
})
