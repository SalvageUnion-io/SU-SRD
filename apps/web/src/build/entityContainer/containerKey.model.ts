import type { Container } from 'game-domain/container'

/**
 * A container as one string, `shelf` or `game:<id>`: a select option's value
 * and a list key. The pair (kind, id) is one decision, so it is one value.
 * Its own module: `ContainerPicker` exports components only (Fast Refresh).
 */
export function serializeContainer(container: Container): string {
  return container.kind === 'game' ? `game:${container.gameId}` : 'shelf'
}
