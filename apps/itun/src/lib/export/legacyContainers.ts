import { containerOf } from '../container'
import type { ContainerFields } from '../container'

/**
 * Give imported entities a container (ADR-030 §2).
 *
 * A bundle exported before the Game/Shelf split carries `workspaceId` and no
 * `gameId`, so importing one straight into the new model would leave every
 * entity in the "not yet decided" state — legible to `containerOf`, but
 * indefinitely undecided, and invisible to anything that filters by container.
 *
 * The mapping is deliberately the **same rule migration 13 applies**, reused
 * rather than restated: a bundle restored on a new device has to land in the
 * same place the migration would have put it on the old one, or the same
 * roster reads differently depending on how it arrived.
 *
 * The Default workspace becomes the shelf for the reason recorded in that
 * migration: it was never a campaign, only where builds went when they
 * belonged to none.
 */
export function withContainer<T extends ContainerFields>(entity: T): T & { gameId: string | null } {
  const container = containerOf(entity)
  return {
    ...entity,
    gameId: container.kind === 'game' ? container.gameId : null,
  }
}

/** Apply the container rule across a bundle's entity arrays. */
export function assignContainers<T extends ContainerFields>(
  entities: readonly T[]
): Array<T & { gameId: string | null }> {
  return entities.map(withContainer)
}
