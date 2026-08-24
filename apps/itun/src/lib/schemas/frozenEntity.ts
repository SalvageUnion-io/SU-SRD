/**
 * Parse an untrusted entity body against the schema for its kind.
 *
 * ## Why this is its own module
 *
 * It began inside `components/sheet/frozenSheet.ts`, alongside the read-only
 * Zustand store that renders the result. That was fine while rendering was the
 * only caller. The snapshot **publish** handler now needs the same parse — so
 * that a snapshot which cannot be rendered cannot be minted in the first place
 * — and `frozenSheet.ts` imports `zustand` and the entity store.
 *
 * esbuild follows the module, not the call, so importing the parse out of that
 * file would drag the store into the Cloudflare Worker bundle. This is the same
 * lesson `lib/snapshot/handlers.ts` records about `@sentry/node`: the shared
 * thing has to live somewhere neither platform owns.
 *
 * So the parse lives here, importing nothing but the schemas, and every caller
 * is an adapter around it.
 */

import { isRecord } from '../isRecord'
import { normalizeLegacyCargoRecord } from './cargoLot'
import type { Crawler } from './crawler'
import { CrawlerSchema } from './crawler'
import type { Mech } from './mech'
import { MechSchema } from './mech'
import type { Pilot } from './pilot'
import { normalizeLegacyPilotRecord, PilotSchema } from './pilot'

/** A parsed frozen entity, or the reason it could not be parsed. */
export type FrozenParse =
  | { ok: true; kind: 'pilot'; entity: Pilot }
  | { ok: true; kind: 'mech'; entity: Mech }
  | { ok: true; kind: 'crawler'; entity: Crawler }
  | { ok: false; reason: string }

/**
 * Validate an untrusted entity body against the schema for its kind.
 *
 * Untrusted in all three callers, and for the same reason: a snapshot payload
 * was published by some other version of this app, a server row was written by
 * some other player's browser, and a publish request is simply whatever arrived
 * on an unauthenticated POST. None is a record this session created, so all go
 * through Zod rather than a cast — a mismatch renders an explanation or is
 * refused at the door, never a crash mid-sheet.
 */
export function parseFrozenEntity(kind: unknown, entity: unknown): FrozenParse {
  if (!isRecord(entity) || Array.isArray(entity)) {
    return { ok: false, reason: 'Entity data is missing or invalid.' }
  }

  if (kind === 'pilot') {
    // Records written before the vestigial `rollResults` removal still carry
    // the field — the same rewrite parseImportBundle applies.
    const parsed = PilotSchema.safeParse(normalizeLegacyPilotRecord(entity))
    return parsed.success
      ? { ok: true, kind: 'pilot', entity: parsed.data }
      : { ok: false, reason: `Invalid pilot data: ${parsed.error.message}` }
  }

  if (kind === 'mech') {
    // Records written before the cargo→cargoLots rename carry a legacy
    // `cargo: string[]` field — the same rewrite parseImportBundle applies.
    const parsed = MechSchema.safeParse(normalizeLegacyCargoRecord(entity))
    return parsed.success
      ? { ok: true, kind: 'mech', entity: parsed.data }
      : { ok: false, reason: `Invalid mech data: ${parsed.error.message}` }
  }

  if (kind === 'crawler') {
    const parsed = CrawlerSchema.safeParse(entity)
    return parsed.success
      ? { ok: true, kind: 'crawler', entity: parsed.data }
      : { ok: false, reason: `Invalid crawler data: ${parsed.error.message}` }
  }

  return { ok: false, reason: `Unknown entity kind: ${String(kind)}` }
}
