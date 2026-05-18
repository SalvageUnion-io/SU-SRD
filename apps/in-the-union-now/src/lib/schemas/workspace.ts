import { z } from 'zod'

/**
 * A Workspace groups related entities (pilots, mechs, crawlers) for a
 * single campaign or play session. It has no game-data references of its own.
 */
export const WorkspaceSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    name: z.string(),
    createdAt: z.string().datetime(),
  })
  .strict()

export type Workspace = z.infer<typeof WorkspaceSchema>
