import { z } from 'zod'

/**
 * classRef: slug reference to a class in salvageunion-reference.
 * Resolution against game data is handled at the presentation/query layer.
 */
export const PilotSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    name: z.string(),
    callsign: z.string(),
    /** Slug reference to a Pilot Class in salvageunion-reference */
    classRef: z.string(),
    /** Slugs of class abilities selected for this pilot */
    abilities: z.array(z.string()),
    /** Slugs of equipment items carried */
    equipment: z.array(z.string()),
    /** Freeform roll result strings (injury table, etc.) */
    rollResults: z.array(z.string()),
    motto: z.string(),
    keepsake: z.string(),
    appearance: z.string(),
    /** Active condition slugs */
    conditions: z.array(z.string()),
    /** Optional: links this pilot to a workspace */
    workspaceId: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Pilot = z.infer<typeof PilotSchema>
