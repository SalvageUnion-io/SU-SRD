import { z } from 'salvageunion-reference/zod'

/**
 * The import format of the 4.5.0 cutover: what the one-off copy reads out of
 * Convex and hands to the account and Game rooms and to D1.
 *
 * Convex is only read, never written (Jrvs, 2026-10-25): every bundle is a
 * copy, keyed so that importing it twice changes nothing. An account is keyed
 * by its Discord id, a unit by its app id, a Game by its old Convex id.
 */

const Body = z.record(z.string(), z.unknown())

/** One op as ADR-063 defines it (`game-domain/ops/applyOp`); a body written before it is seq 0. */
const BundleOpSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  seq: z.number().int().nullable(),
  baseSeq: z.number().int().nullable(),
  author: z.string().nullable(),
  at: z.number(),
  kind: z.enum(['transaction', 'override', 'manual']),
  source: z.string(),
  state: z.enum(['applied', 'proposed', 'declined', 'superseded']),
  patch: Body,
  unset: z.array(z.string()).optional(),
  before: Body.nullable(),
  reason: z.string().optional(),
})
export type BundleOp = z.infer<typeof BundleOpSchema>

const UNIT_KINDS = ['pilot', 'mech', 'crawler', 'npc'] as const

/** A pilot, mech, crawler or NPC: its snapshot and its op log. */
const BundleUnitSchema = z.object({
  kind: z.enum(UNIT_KINDS),
  appId: z.string(),
  /** Discord id of its owner or assignee; null for an unassigned unit in a Game. */
  owner: z.string().nullable(),
  publicRead: z.boolean(),
  body: Body,
  headSeq: z.number().int(),
  /** Seq of the op that last wrote each field (ADR-063's conflict check); empty at seq 0. */
  fieldSeqs: z.record(z.string(), z.number().int()),
  updatedAt: z.number(),
  ops: z.array(BundleOpSchema),
})
export type BundleUnit = z.infer<typeof BundleUnitSchema>

/** A body without an op log: a saved pattern, an encounter, a tray NPC. */
const BundleRecordSchema = z.object({
  appId: z.string(),
  body: Body,
  extra: z.record(z.string(), z.unknown()),
})
export type BundleRecord = z.infer<typeof BundleRecordSchema>

const BundleLinkSchema = z.object({
  type: z.string(),
  from: z.object({ type: z.string(), id: z.string() }),
  to: z.object({ type: z.string(), id: z.string() }),
  slot: z.unknown().optional(),
})

export const AccountBundleSchema = z.object({
  discordId: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  units: z.array(BundleUnitSchema),
  patterns: z.array(BundleRecordSchema),
  encounters: z.array(BundleRecordSchema),
  npcTray: z.array(BundleRecordSchema),
  links: z.array(BundleLinkSchema),
  seats: z.array(z.record(z.string(), z.unknown())),
  channelBindings: z.array(z.record(z.string(), z.unknown())),
})
export type AccountBundle = z.infer<typeof AccountBundleSchema>

export const GameBundleSchema = z.object({
  gameId: z.string(),
  name: z.string(),
  members: z.array(
    z.object({
      discordId: z.string(),
      mediator: z.boolean(),
      organizer: z.boolean(),
      joinedAt: z.number(),
    })
  ),
  /** The live invite code, if the Game has one. */
  inviteCode: z.string().nullable(),
  primaryCrawler: z.string().nullable(),
  units: z.array(BundleUnitSchema),
  /** The Mediator's Opposition: hidden from players (ADR-030 §5). */
  opposition: z.array(BundleRecordSchema),
  links: z.array(BundleLinkSchema),
  seats: z.array(z.record(z.string(), z.unknown())),
  downtime: z.record(z.string(), z.unknown()).nullable(),
  runningEncounter: z.record(z.string(), z.unknown()).nullable(),
  channelBindings: z.array(z.record(z.string(), z.unknown())),
  /** Patterns shared with this Game's crew (ADR-032 §7), by app id. */
  crewPatterns: z.array(z.string()),
})
export type GameBundle = z.infer<typeof GameBundleSchema>

/** What crosses rooms and lands in D1: homebrew, signals, photos. */
export const SiteBundleSchema = z.object({
  homebrewReports: z.array(
    z.object({ patternAppId: z.string(), reporter: z.string(), reason: z.string(), at: z.number() })
  ),
  homebrewHidden: z.array(
    z.object({ patternAppId: z.string(), hiddenAt: z.number().nullable(), reportCount: z.number() })
  ),
  usageCounts: z.array(z.object({ key: z.string(), weekStart: z.number(), count: z.number() })),
  botGuilds: z.array(
    z.object({ guildId: z.string(), firstSeenAt: z.number(), lastSeenAt: z.number() })
  ),
  metricsSnapshots: z.array(z.record(z.string(), z.unknown())),
  feedback: z.array(z.record(z.string(), z.unknown())),
  /** Uploaded photos to copy from Convex file storage to R2, by storage id. */
  photos: z.array(z.object({ storageId: z.string(), owner: z.string() })),
})
export type SiteBundle = z.infer<typeof SiteBundleSchema>
