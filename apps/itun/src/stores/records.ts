/**
 * Build and check one player-entity record, in memory.
 *
 * The stores hold only what this page load's Convex subscriptions delivered
 * and this tab's own accepted writes (ADR-034, as amended by the D9 decision:
 * there is no device cache). This is the part of a write that happens before
 * the server sees it: mint the id, stamp the timestamps and strict-parse, so a
 * record is finished — and refusable — before anything local changes.
 *
 * Zod schemas (`lib/schemas/`) are the source of truth for a record's shape
 * (ADR-002): every create, update and adopted server row parses strictly.
 */

import type { z } from 'salvageunion-reference/zod'
import { CrawlerSchema } from '../lib/schemas/crawler'
import { EncounterNpcSchema } from '../lib/schemas/encounterNpc'
import { MechSchema } from '../lib/schemas/mech'
import { NpcSchema } from '../lib/schemas/npc'
import { MechPatternSchema } from '../lib/schemas/pattern'
import { PilotSchema } from '../lib/schemas/pilot'
import { SoftLinkSchema } from '../lib/schemas/softLink'

/** One kind of record: its schema, and whether it carries `updatedAt`. */
export type RecordKind<T> = {
  name: string
  schema: z.ZodType<T>
  /** Pilots, mechs, crawlers, NPCs and the tray do; links and patterns do not. */
  hasUpdatedAt: boolean
}

function kind<T>(name: string, schema: z.ZodType<T>, hasUpdatedAt: boolean): RecordKind<T> {
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
    throw new Error(`[itun-store] Cannot update: record id="${id}" not found in "${spec.name}"`)
  }
  const candidate: Record<string, unknown> = { ...existing, ...patch, id }
  if (spec.hasUpdatedAt) candidate.updatedAt = new Date().toISOString()
  return spec.schema.parse(candidate)
}

/**
 * A row the server sent, checked before a store holds it. Throws on one that
 * does not parse: `ShelfSync` reports it and carries on with the rest.
 */
export function parseServed<T extends { id: string }>(spec: RecordKind<T>, record: T): T {
  const strict = spec.schema.safeParse(record)
  if (!strict.success) {
    throw new Error(
      `[itun-store] Cannot hold record id="${record.id}" in "${spec.name}": it does not parse`
    )
  }
  return strict.data
}

/** Put `record` in `list`, replacing the one with its id or prepending it. */
export function upsertById<T extends { id: string }>(list: readonly T[], record: T): T[] {
  return list.some((e) => e.id === record.id)
    ? list.map((e) => (e.id === record.id ? record : e))
    : [record, ...list]
}
