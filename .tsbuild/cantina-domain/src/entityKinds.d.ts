/**
 * The Cantina's entity kinds, the Convex table each lives in, and the app
 * addresses that name them.
 *
 * Routes and bodies speak the singular kind (`pilot`); Convex tables speak the
 * plural (`pilots`). This module is the one map between them, read by the
 * client, `apps/web/convex/` and the Discord bot. It imports nothing, so the
 * bot can read it without pulling in Convex or React.
 */
/** Every kind with a sheet of its own: a pilot, mech, crawler or built NPC. */
export declare const ENTITY_KINDS: readonly ['pilot', 'mech', 'crawler', 'npc'];
/** A kind with a sheet. */
export type EntityKind = (typeof ENTITY_KINDS)[number];
/** Each kind, mapped to the table its rows live in. */
export declare const TABLE_OF_KIND: {
    readonly pilot: 'pilots';
    readonly mech: 'mechs';
    readonly crawler: 'crawlers';
    readonly npc: 'npcs';
};
/** The table an {@link EntityKind}'s rows live in. */
export type EntityTable = (typeof TABLE_OF_KIND)[EntityKind];
/** The three kinds a player fields: what the roster lists and the bot reads. */
export type SheetKind = Exclude<EntityKind, 'npc'>;
/** The table a {@link SheetKind}'s rows live in. */
export type SheetTable = (typeof TABLE_OF_KIND)[SheetKind];
/** The two kinds that carry an owner. Crawlers are communal by design. */
export type OwnableKind = Exclude<SheetKind, 'crawler'>;
/** The table an {@link OwnableKind}'s rows live in. */
export type OwnableTable = (typeof TABLE_OF_KIND)[OwnableKind];
/** What a public page addresses: any sheet, or a saved mech pattern. */
export type PublicKind = EntityKind | 'pattern';
/** The kind a table holds: `pilots` → `pilot`. */
export declare function kindOf(table: EntityTable): EntityKind;
/** Whether `value` names a kind with a sheet. */
export declare function isEntityKind(value: string): value is EntityKind;
/**
 * The live sheet's address under the Cantina's base, by row id or app id:
 * `/sheet/<kind>/<id>`.
 */
export declare function sheetPath(kind: EntityKind, id: string): string;
/** A thing's public, account-free address, one page per thing (ADR-032): `/p/<kind>/<appId>`. */
export declare function publicPath(kind: PublicKind, appId: string): string;
/** A Game's own page: `/games/<gameId>`. */
export declare function gamePath(gameId: string): string;
