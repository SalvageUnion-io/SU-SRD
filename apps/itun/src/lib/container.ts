/**
 * Which container an entity lives in (ADR-030 §2).
 *
 * There are exactly two: a shared **Game**, or the owner's personal **Shelf**.
 * They are encoded in one nullable column rather than two fields, because an
 * entity is always in exactly one and a second field could contradict the
 * first.
 *
 * `null` means "on the shelf", a real place. A body can also carry no `gameId`
 * at all: a template-seeded server body names no Game, and adoption stamps the
 * row's column into it (`planCrawlerSync`). Until then it reads as the shelf.
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
}

/** Resolve where an entity lives: the Game its `gameId` names, else the shelf. */
export function containerOf(entity: ContainerFields): Container {
  return typeof entity.gameId === 'string' ? { kind: 'game', gameId: entity.gameId } : SHELF
}

/**
 * Whether two containers are the same place.
 *
 * Containers are compared structurally rather than by reference: `containerOf`
 * builds a fresh object on every call, so `===` would be false for two reads of
 * the same entity and every filter written against it would return nothing.
 */
export function sameContainer(a: Container, b: Container): boolean {
  if (a.kind === 'game' && b.kind === 'game') return a.gameId === b.gameId
  return a.kind === b.kind
}

/** The patch that moves an entity into a container. */
export function moveTo(container: Container): { gameId: string | null } {
  return { gameId: container.kind === 'game' ? container.gameId : null }
}

/**
 * Where a container is shown (issue 1255): the shelf on Shelves at `/`, a Game on
 * its own page at `/games/<id>`. A Game has a real address, so a link to one
 * opens it whatever the hub showed last.
 */
export function containerHref(container: Container): string {
  return container.kind === 'game' ? `/games/${encodeURIComponent(container.gameId)}` : '/'
}
