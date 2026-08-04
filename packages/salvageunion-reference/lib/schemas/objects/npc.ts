/**
 * NPCs attached to another record (a crawler bay's crew member, for example) —
 * distinct from the standalone `npcs` entity schema.
 */

import { z } from '../../zod.js'
import { NameSchema, NonNegativeIntegerSchema } from '../common.js'
import { ContentSchema } from './content.js'
import { ChoicesSchema } from './choices.js'

/**
 * NPC associated with an entity
 */
export const NpcSchema = z
  .lazy(() =>
    z
      .object({
        position: NameSchema.describe('Role or position title of this NPC'),
        content: ContentSchema.describe('Descriptive content about this NPC').optional(),
        hitPoints: NonNegativeIntegerSchema.describe('Hit points of this NPC'),
        choices: ChoicesSchema.describe(
          'Choices available when interacting with this NPC'
        ).optional(),
      })
      .strict()
  )
  .describe('NPC associated with an entity (e.g., crawler bay crew member)')
