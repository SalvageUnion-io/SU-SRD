/**
 * Build and check one player-entity record, in memory.
 *
 * The stores hold only what this page load's Convex subscriptions delivered
 * and this tab's own accepted writes (ADR-034, as amended), or offline what the
 * device copy last saved (ADR-058). This is the part of a write that happens before
 * the server sees it: mint the id, stamp the timestamps and strict-parse, so a
 * record is finished — and refusable — before anything local changes.
 *
 * Zod schemas (`lib/schemas/`) are the source of truth for a record's shape
 * (ADR-002): every create, update and adopted server row parses strictly.
 */

import { CrawlerSchema } from 'game-domain/schemas/crawler'
import { EncounterSchema } from 'game-domain/schemas/encounter'
import { EncounterNpcSchema } from 'game-domain/schemas/encounterNpc'
import { MechSchema } from 'game-domain/schemas/mech'
import { NpcSchema } from 'game-domain/schemas/npc'
import { MechPatternSchema } from 'game-domain/schemas/pattern'
import { PilotSchema } from 'game-domain/schemas/pilot'
import { SoftLinkSchema } from 'game-domain/schemas/softLink'
import type { z } from 'salvageunion-reference/zod'

/** One kind of record: its schema, and whether it carries `updatedAt`. */
export type RecordKind<T> = {
  name: string
  schema: z.ZodType<T>
  /** Pilots, mechs, crawlers, NPCs and the tray do; links and patterns do not. */
  hasUpdatedAt: boolean
}

function kind<N extends string, T>(
  name: N,
  schema: z.ZodType<T>,
  hasUpdatedAt: boolean
): RecordKind<T> & { name: N } {
  return { name, schema, hasUpdatedAt }
}

export const RECORD_KINDS = {
  pilot: kind('pilots', PilotSchema, true),
  mech: kind('mechs', MechSchema, true),
  crawler: kind('crawlers', CrawlerSchema, true),
  npc: kind('npcs', NpcSchema, true),
  softLink: kind('softLinks', SoftLinkSchema, false),
  mechPattern: kind('mechPatterns', MechPatternSchema, false),
  encounterNpc: kind('encounterNpcs', EncounterNpcSchema, true),
  encounter: kind('encounters', EncounterSchema, true),
}

/** A new record: a fresh UUID, `createdAt` (and `updatedAt`), strict-parsed. */
export function prepareCreate<T>(spec: RecordKind<T>, input: object): T {
  const now = new Date().toISOString()
  const candidate: Record<string, unknown> = { ...input, id: crypto.randomUUID(), createdAt: now }
  if (spec.hasUpdatedAt) candidate.updatedAt = now
  return spec.schema.parse(candidate)
}

/**
 * `existing` with `patch` merged over it, `updatedAt` bumped, strict-parsed.
 * The id is immutable. Throws when there is no record to update.
 */
export function prepareUpdate<T>(
  spec: RecordKind<T>,
  existing: T | null,
  id: string,
  patch: object
): T {
  if (existing === null) {
    throw new Error(`[app-store] Cannot update: record id="${id}" not found in "${spec.name}"`)
  }
  const candidate: Record<string, unknown> = { ...existing, ...patch, id }
  if (spec.hasUpdatedAt) candidate.updatedAt = new Date().toISOString()
  return spec.schema.parse(candidate)
}
