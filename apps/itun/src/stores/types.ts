import type { Crawler } from '../lib/schemas/crawler'
import type { Mech } from '../lib/schemas/mech'
import type { Pilot } from '../lib/schemas/pilot'
import type { SoftLink } from '../lib/schemas/softLink'

/** The four entity types managed by entityStore. */
export type EntityType = 'pilot' | 'mech' | 'crawler' | 'softLink'

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
      : SoftLink

/**
 * Input type for db.create() — strips id/createdAt/updatedAt (injected by the
 * db layer). Mirrors EntityStore<T>.create's parameter from crud.ts.
 */
export type CreateInput<T extends EntityType> = Omit<
  EntityForType<T>,
  'id' | 'createdAt' | 'updatedAt'
>

/** The three entity types that carry a container (SoftLink does not). */
export type AssignableType = 'pilot' | 'mech' | 'crawler'
