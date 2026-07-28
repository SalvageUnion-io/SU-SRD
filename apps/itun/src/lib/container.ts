import { DEFAULT_WORKSPACE_ID } from './defaultWorkspace'

/**
 * Which container an entity lives in (ADR-030 §2).
 *
 * There are exactly two: a shared **Game**, or the owner's personal **Shelf**.
 * They are encoded in one nullable column rather than two fields, because an
 * entity is always in exactly one and a second field could contradict the
 * first.
 *
 * The subtle part is that **`null` is a value, not an absence**. `null` means
 * "on the shelf" — a real place — while `undefined` means "this record predates
 * the split and we have not decided yet". Conflating them is the bug this
 * module exists to prevent: treating a shelved entity as unmigrated would send
 * it back through the fallback on every read.
 */

/** A shared Game, by id. */
export type GameContainer = { kind: 'game'; gameId: string }
/** The owner's personal shelf. Not a Game: no crew, no Mediator, no invites. */
export type ShelfContainer = { kind: 'shelf' }

export type Container = GameContainer | ShelfContainer

export const SHELF: ShelfContainer = { kind: 'shelf' }

/** The minimum an entity needs to expose for its container to be resolved. */
export type ContainerFields = {
  gameId?: string | null | undefined
  /** @deprecated Read only as a fallback for records written before ADR-030. */
  workspaceId?: string | undefined
}

/**
 * Resolve where an entity lives.
 *
 * The fallback chain matters and is ordered deliberately:
 *
 *  1. `gameId` set to a string — it is in that Game.
 *  2. `gameId` explicitly `null` — it is on the shelf. Decided; stop.
 *  3. `gameId` absent — pre-split record, so fall back to `workspaceId`, with
 *     the built-in Default workspace mapping to the shelf rather than to a
 *     Game. The Default workspace was never a campaign; it was the place
 *     builds went when they belonged to no campaign, which is precisely a
 *     shelf.
 */
export function containerOf(entity: ContainerFields): Container {
  if (typeof entity.gameId === 'string') return { kind: 'game', gameId: entity.gameId }
  if (entity.gameId === null) return SHELF
  if (entity.workspaceId !== undefined && entity.workspaceId !== DEFAULT_WORKSPACE_ID) {
    return { kind: 'game', gameId: entity.workspaceId }
  }
  return SHELF
}

/** True when the entity is on the owner's shelf rather than in a Game. */
export function isOnShelf(entity: ContainerFields): boolean {
  return containerOf(entity).kind === 'shelf'
}

/** The Game id, or null when the entity is shelved. */
export function gameIdOf(entity: ContainerFields): string | null {
  const container = containerOf(entity)
  return container.kind === 'game' ? container.gameId : null
}

/** The patch that moves an entity into a container. */
export function moveTo(container: Container): { gameId: string | null } {
  return { gameId: container.kind === 'game' ? container.gameId : null }
}
