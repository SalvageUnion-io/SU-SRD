/**
 * The Starter Set as reference data: read by anyone, owned by Leyline Press,
 * written by nobody.
 *
 * The templates in `./starterSet` are never stored, never adopted and never
 * edited. They are read through a read-only sheet store (the `/starter` pages),
 * and the only way to play one is to **copy** it into a container the player
 * picks — My Stuff or one of their Games. The copy is an ordinary build the
 * player owns, made through `entityStore.create`, so it is refused signed out
 * and committed to the server of record before anything local is written.
 *
 * This replaces "Load Starter Set", which seeded the whole crew onto the
 * player's Shelf. That made the reference data look like the player's own
 * builds, and every row of it editable and deletable.
 *
 * ## A copy is a new thing
 *
 * `create` mints a fresh id: a template's id in an account would put one id in
 * every account that copied it, and a duplicate `appId` resolves to the oldest
 * row, so a second player's writes would aim at the first player's entity. The
 * template slug is kept as `seedRef`, which is what it is for. The name is kept
 * as it is — a copied pre-gen is the character you are going to play, not a
 * "COPY OF" anything.
 */

import type { EntityType } from '../../stores/entityStore'
import { useEntityStore } from '../../stores/entityStore'
import type { Container } from '../container'
import { moveTo } from '../container'
import type { Crawler } from '../schemas/crawler'
import type { Mech } from '../schemas/mech'
import type { Pilot } from '../schemas/pilot'
import { STARTER_CRAWLERS, STARTER_MECHS, STARTER_PILOTS } from './starterSet'

/** Who the Starter Set belongs to — the seal on every row and sheet. */
export const STARTER_SET_PUBLISHER = 'Leyline Press'

/** The adventure the pre-generated crew comes from. */
export const STARTER_SET_ADVENTURE = 'Reclamation of the Wastes'

export type StarterKind = Exclude<EntityType, 'softLink'>

/** One template by kind and id, or null when there is no such template. */
export function starterTemplate(kind: StarterKind, id: string): Pilot | Mech | Crawler | null {
  const all: readonly (Pilot | Mech | Crawler)[] =
    kind === 'pilot' ? STARTER_PILOTS : kind === 'mech' ? STARTER_MECHS : STARTER_CRAWLERS
  return all.find((t) => t.id === id) ?? null
}

/**
 * Copy one template into `to`, as a build the player owns. Resolves to what was
 * stored; rejects when the store refuses (signed out, offline) or the server
 * does.
 */
export async function copyStarter(
  kind: StarterKind,
  templateId: string,
  to: Container
): Promise<{ id: string; name: string }> {
  const template = starterTemplate(kind, templateId)
  if (template === null) throw new Error(`There is no Starter Set ${kind} "${templateId}".`)

  // A deep copy, so nothing the new build does can reach back into the
  // template it came from.
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...body
  } = structuredClone(template) as Record<string, unknown> & { id: string }

  return await useEntityStore
    .getState()
    .create(kind, { ...body, seedRef: templateId, ...moveTo(to) } as never)
}
