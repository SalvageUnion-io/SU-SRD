import { z } from 'zod'

/**
 * chassisRef: slug reference to a Chassis in salvageunion-reference.
 * Resolution against game data is handled at the presentation/query layer.
 */
export const MechSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    name: z.string(),
    /** Slug reference to a Chassis in salvageunion-reference */
    chassisRef: z.string(),
    /** Slugs of mech system items installed */
    systems: z.array(z.string()),
    /** Slugs of mech module items installed */
    modules: z.array(z.string()),
    /** Slugs of cargo items carried in the mech */
    cargo: z.array(z.string()),
    /** Optional: name of the paint/visual pattern applied */
    patternName: z.string().optional(),
    /** Active condition slugs */
    conditions: z.array(z.string()),
    /** Optional: links this mech to a workspace */
    workspaceId: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Mech = z.infer<typeof MechSchema>
