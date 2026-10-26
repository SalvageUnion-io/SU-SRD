/**
 * A wizard started from a Game's page (ADR-052 §3): `/pilots/new?game=<id>`,
 * `/mechs/new?game=<id>`, `/crawlers/new?game=<id>`. The new unit lands in that
 * Game, and finishing or cancelling returns to the Game's page in Play.
 *
 * The id is a row id: letters and digits only. Anything else is dropped,
 * so a hand-edited URL cannot aim a create or a navigation anywhere odd; the
 * server still refuses a Game the player is not in (`assertMayAddToContainer`).
 */

const GAME_ID = /^[a-z0-9]+$/i

/** Narrow a raw `?game=` to a Game id (routes' validateSearch). */
export function parseGameParam(value: unknown): string | undefined {
  return typeof value === 'string' && GAME_ID.test(value) ? value : undefined
}

/** A `/…/new` link that starts the wizard for `gameId`'s Game. */
export function newInGameHref(
  path: '/pilots/new' | '/mechs/new' | '/crawlers/new',
  gameId: string
) {
  return `${path}?game=${encodeURIComponent(gameId)}`
}
