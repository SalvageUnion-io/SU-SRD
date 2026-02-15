import { z } from 'zod'

// Shared validation helpers
export const uuid = z.string().uuid()
export const jsonValue: z.ZodType = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(jsonValue), z.array(jsonValue)])
)
export const jsonObject = z.record(jsonValue)
