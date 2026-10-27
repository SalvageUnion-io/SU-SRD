/**
 * The app's entity kinds, the table each lives in, and the app addresses
 * that name them.
 *
 * Routes and bodies speak the singular kind (`pilot`); tables speak the
 * plural (`pilots`). This module is the one map between them, read by the
 * client, the Worker and the Discord bot. It imports nothing but its sibling
 * `shareAddress`, so the bot can read it without pulling in React.
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
 * The live sheet's route in the app, by row id or app id: the plural of its
 * kind, then the id (`/pilots/<id>`, `/npcs/<id>`), as the wizard that makes
 * it is `/pilots/new`.
 */
export function sheetPath(kind: EntityKind, id: string): string {
  return `/${kind}s/${encodeURIComponent(id)}`
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

/** A Game's Mediator Cockpit, under its page: `/play/games/<gameId>/mediate`. */
export function mediatePath(gameId: string): string {
  return `${gamePath(gameId)}/mediate`
}

/**
 * An invite link's route, the Game's door (ADR-052 §4): `/play/invite/<token>`,
 * the token being the invite's code.
 */
export function invitePath(token: string): string {
  return `/play/invite/${encodeURIComponent(token)}`
}

/** One pilot's Cockpit in Play (ADR-051): `/play/pilots/<pilotId>`. */
export function cockpitPath(pilotId: string): string {
  return `/play/pilots/${encodeURIComponent(pilotId)}`
}
