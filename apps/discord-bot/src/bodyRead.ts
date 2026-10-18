import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { EntityBody } from './play/types'

/** Defensive reads off a sheet's body, for the cards in `gameCards.ts`. */

/**
 * A field name off one of the entity schemas.
 *
 * Convex stores the body as `v.any()`, so the bot reads it by name, and the
 * names are the Zod schemas' in `game-domain/schemas/`. Typing the key against
 * them (types only: the bot bundles no Zod) makes a misspelling a compile
 * error rather than a field that silently reads as absent.
 */
export type BodyKey = keyof Pilot | keyof Mech | keyof Crawler

/** Read a finite number off an opaque body, or null. */
export function num(body: EntityBody, key: BodyKey): number | null {
  const value = body[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Read a string off an opaque body, or null when absent/blank/not a string. */
export function str(body: EntityBody, key: BodyKey): string | null {
  const value = body[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/** Read the strings of an array off an opaque body; anything else reads empty. */
export function strArray(body: EntityBody, key: BodyKey): string[] {
  const value = body[key]
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}
