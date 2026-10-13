import type { Crawler } from 'itun-domain/schemas/crawler'
import type { Mech } from 'itun-domain/schemas/mech'
import type { Npc } from 'itun-domain/schemas/npc'
import type { Pilot } from 'itun-domain/schemas/pilot'
import type { SoftLink } from 'itun-domain/schemas/softLink'

/** The five entity types managed by entityStore. */
export type EntityType = 'pilot' | 'mech' | 'crawler' | 'npc' | 'softLink'

/**
 * Maps each EntityType discriminant to its runtime type.
 * Conditional type — narrows the return value of list/get/create/update
 * based on the `type` argument passed at the call site.
 */
export type EntityForType<T extends EntityType> = T extends 'pilot'
  ? Pilot
  : T extends 'mech'
    ? Mech
    : T extends 'crawler'
      ? Crawler
      : T extends 'npc'
        ? Npc
        : SoftLink

/**
 * Input type for an entity create — strips id/createdAt/updatedAt, which
 * stores/records.ts (prepareCreate) mints.
 */
export type CreateInput<T extends EntityType> = Omit<
  EntityForType<T>,
  'id' | 'createdAt' | 'updatedAt'
>

/** The entity types that carry a container (SoftLink does not). */
export type AssignableType = 'pilot' | 'mech' | 'crawler' | 'npc'
