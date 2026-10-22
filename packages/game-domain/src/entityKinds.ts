/**
 * The app's entity kinds, the Convex table each lives in, and the app
 * addresses that name them.
 *
 * Routes and bodies speak the singular kind (`pilot`); Convex tables speak the
 * plural (`pilots`). This module is the one map between them, read by the
 * client, `apps/web/convex/` and the Discord bot. It imports nothing but its sibling
 * `shareAddress`, so the bot can read it without pulling in Convex or React.
 */

import { shareSegment } from './shareAddress'

/** Every kind with a sheet of its own: a pilot, mech, crawler or built NPC. */
export const ENTITY_KINDS = ['pilot', 'mech', 'crawler', 'npc'] as const

/** A kind with a sheet. */
export type EntityKind = (typeof ENTITY_KINDS)[number]

/** Each kind, mapped to the table its rows live in. */
export const TABLE_OF_KIND = {
  pilot: 'pilots',
  mech: 'mechs',
  crawler: 'crawlers',
  npc: 'npcs',
} as const satisfies Record<EntityKind, string>

/** The table an {@link EntityKind}'s rows live in. */
export type EntityTable = (typeof TABLE_OF_KIND)[EntityKind]

/** The three kinds a player fields: what the roster lists and the bot reads. */
export type SheetKind = Exclude<EntityKind, 'npc'>

/** Every {@link SheetKind}: a pilot, mech or crawler. */
export const SHEET_KINDS = ['pilot', 'mech', 'crawler'] as const satisfies readonly SheetKind[]

/** The table a {@link SheetKind}'s rows live in. */
export type SheetTable = (typeof TABLE_OF_KIND)[SheetKind]

/** The two kinds that carry an owner. Crawlers are communal by design. */
export type OwnableKind = Exclude<SheetKind, 'crawler'>

/** The table an {@link OwnableKind}'s rows live in. */
export type OwnableTable = (typeof TABLE_OF_KIND)[OwnableKind]

/** What a public page addresses: any sheet, or a saved mech pattern. */
export type PublicKind = EntityKind | 'pattern'

const KIND_OF_TABLE: Readonly<Record<EntityTable, EntityKind>> = {
  pilots: 'pilot',
  mechs: 'mech',
  crawlers: 'crawler',
  npcs: 'npc',
}

/** The kind a table holds: `pilots` → `pilot`. */
export function kindOf(table: EntityTable): EntityKind {
  return KIND_OF_TABLE[table]
}

/** Whether `value` names a kind with a sheet. */
export function isEntityKind(value: string): value is EntityKind {
  return Object.hasOwn(TABLE_OF_KIND, value)
}

/** Whether `value` names a kind a player fields (never an NPC). */
export function isSheetKind(value: string): value is SheetKind {
  return (SHEET_KINDS as readonly string[]).includes(value)
}

/**
 * The live sheet's address under the app's base, by row id or app id:
 * `/sheet/<kind>/<id>`.
 */
export function sheetPath(kind: EntityKind, id: string): string {
  return `/sheet/${kind}/${encodeURIComponent(id)}`
}

/**
 * A thing's public, account-free address, one page per thing (ADR-032):
 * `/p/<kind>/<segment>`, the segment readable and short when the name is
 * given (`shareSegment`: `/p/pilot/rook-vance-0a1b2c3d4e5f`).
 */
export function publicPath(kind: PublicKind, appId: string, name?: string): string {
  return `/p/${kind}/${encodeURIComponent(shareSegment(appId, name))}`
}

/** A Game's own page, in Play (ADR-052 §5): `/play/games/<gameId>`. */
export function gamePath(gameId: string): string {
  return `/play/games/${encodeURIComponent(gameId)}`
}
