/**
 * Zod validation schemas for player choice operations
 * Validates player choice data before database writes
 *
 * HYBRID APPROACH:
 * - Base schemas auto-generated from Supabase types (database-generated.zod.ts)
 * - Extended with custom business logic validation
 *
 * NESTED CHOICES:
 * - A player_choice can belong to either an entity OR another player_choice
 * - Exactly one parent must be set (entity_id XOR player_choice_id)
 */

import { z } from 'zod'
import { publicPlayerChoicesInsertSchema } from '../../types/database-generated.zod'

/**
 * Player choice creation/upsert schema
 *
 * Extends auto-generated schema with validation for nested choices:
 * - Must have exactly one parent: entity_id OR player_choice_id
 */
export const upsertPlayerChoiceSchema = publicPlayerChoicesInsertSchema.refine(
  (data) => {
    const hasEntityId = !!data.entity_id
    const hasChoiceId = !!(data as { player_choice_id?: string }).player_choice_id
    return hasEntityId !== hasChoiceId
  },
  {
    message: 'Must have exactly one parent: entity_id OR player_choice_id',
  }
)

/**
 * Type exports for use in API functions
 */
export type UpsertPlayerChoiceInput = z.infer<typeof upsertPlayerChoiceSchema>
