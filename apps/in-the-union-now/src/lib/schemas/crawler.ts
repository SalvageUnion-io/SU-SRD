import { z } from 'zod'

/**
 * Crawler tech levels are I–VI per the Salvage Union ruleset.
 */
export const CrawlerSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    name: z.string(),
    /** Tech level (I–VI) expressed as a string slug, e.g. "tech-1" */
    techLevel: z.string(),
    /** Slugs of entities assigned to crawler bays (pilots/mechs) */
    bays: z.array(z.string()),
    /** Slugs of crawler system items installed */
    systems: z.array(z.string()),
    /** Optional: links this crawler to a workspace */
    workspaceId: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Crawler = z.infer<typeof CrawlerSchema>
