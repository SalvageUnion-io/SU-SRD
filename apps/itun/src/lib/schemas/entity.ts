import { z } from 'salvageunion-reference/zod'

export const EntityRefSchema = z
  .object({
    type: z.enum(['pilot', 'mech', 'crawler']),
    id: z.string(),
  })
  .strict()

export type EntityRef = z.infer<typeof EntityRefSchema>
