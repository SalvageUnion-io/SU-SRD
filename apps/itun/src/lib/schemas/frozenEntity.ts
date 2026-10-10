/**
 * Parse an untrusted entity body against the schema for its kind.
 *
 * ## Why this is its own module
 *
 * It began beside the read-only Zustand store that renders the result (now
 * `components/sheet/readOnlySheetStore.ts`). It moved here when the snapshot
 * publish handler in the Cloudflare Worker needed the same parse, because that
 * store imports `zustand` and the entity store and esbuild follows the module,
 * not the call. Publishing is retired (ADR-036), so today every caller is a
 * renderer again — but a parse that imports nothing but the schemas is still
 * the right shape for a module both platforms could reach, so it stays, and
 * every caller is an adapter around it.
 */

import { isRecord } from '../isRecord'
import type { Crawler } from './crawler'
import { CrawlerSchema } from './crawler'
import type { Mech } from './mech'
import { MechSchema } from './mech'
import type { Npc } from './npc'
import { NpcSchema } from './npc'
import type { Pilot } from './pilot'
import { PilotSchema } from './pilot'

/** A parsed frozen entity, or the reason it could not be parsed. */
export type FrozenParse =
  | { ok: true; kind: 'pilot'; entity: Pilot }
  | { ok: true; kind: 'mech'; entity: Mech }
  | { ok: true; kind: 'crawler'; entity: Crawler }
  | { ok: true; kind: 'npc'; entity: Npc }
  | { ok: false; reason: string }

/**
 * Validate an untrusted entity body against the schema for its kind.
 *
 * Untrusted in every caller, for the same reason: a server row — a crewmate's
 * in a Game, or a public sheet — was written by some other player's browser,
 * running some other version of this app. None is a record this session
 * created, so all go through Zod rather than a cast — a mismatch renders an
 * explanation, never a crash mid-sheet.
 */
export function parseFrozenEntity(kind: unknown, entity: unknown): FrozenParse {
  if (!isRecord(entity) || Array.isArray(entity)) {
    return { ok: false, reason: 'Entity data is missing or invalid.' }
  }

  if (kind === 'pilot') {
    const parsed = PilotSchema.safeParse(entity)
    return parsed.success
      ? { ok: true, kind: 'pilot', entity: parsed.data }
      : { ok: false, reason: `Invalid pilot data: ${parsed.error.message}` }
  }

  if (kind === 'mech') {
    const parsed = MechSchema.safeParse(entity)
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

  if (kind === 'npc') {
    const parsed = NpcSchema.safeParse(entity)
    return parsed.success
      ? { ok: true, kind: 'npc', entity: parsed.data }
      : { ok: false, reason: `Invalid NPC data: ${parsed.error.message}` }
  }

  return { ok: false, reason: `Unknown entity kind: ${String(kind)}` }
}
