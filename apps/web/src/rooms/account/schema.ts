/**
 * An account room's tables: one Durable Object per player (named by their
 * Discord id) holds everything Convex kept on their Shelf.
 *
 * - `account`: the one row naming whose room this is.
 * - `units`, `ops`, `links`: the Shelf's pilots, mechs, crawlers and NPCs,
 *   their op logs and their wiring, in the Game room's columns (`../game/schema.ts`),
 *   so one store reads both. `owner_id` is always the account's.
 * - `seats`: each Shelf pilot's solo play state and solo Downtime.
 * - `records`: the op-less bodies, by table: saved patterns, encounters and
 *   the NPC tray.
 * - `leases` and `imports`: as the Game room's, for handoffs and the cutover.
 */
/** Step 1 of `ACCOUNT_ROOM` (`../schemas.ts`). */
export const ACCOUNT_ROOM_TABLES: readonly string[] = [
  `create table account (
        id integer primary key check (id = 1),
        discord_id text not null,
        display_name text,
        avatar_url text,
        created_at integer not null
      )`,
  `create table units (
        id text primary key,
        kind text not null,
        owner_id text,
        body text not null,
        head_seq integer not null,
        field_seqs text not null,
        public_read integer not null default 0,
        created_at integer not null,
        updated_at integer not null,
        lease_id text
      )`,
  `create table ops (
        id text primary key,
        unit_id text not null,
        seq integer,
        base_seq integer,
        author text not null,
        at integer not null,
        kind text not null,
        source text not null,
        state text not null,
        patch text not null,
        unset text,
        before text,
        reason text,
        superseded_by text
      )`,
  'create index ops_unit_seq on ops (unit_id, seq)',
  `create table links (
        type text not null,
        from_id text not null,
        to_id text not null,
        slot_key text not null default '',
        slot text,
        primary key (type, from_id, to_id, slot_key)
      )`,
  'create index links_to on links (to_id)',
  `create table seats (
        pilot_id text primary key,
        mount text not null,
        range_band text not null,
        active_effects text not null,
        resolving text,
        ejected integer not null default 0,
        downtime_state text,
        updated_at integer not null
      )`,
  `create table records (
        tbl text not null,
        app_id text not null,
        body text not null,
        extra text not null,
        primary key (tbl, app_id)
      )`,
  `create table leases (
        lease_id text primary key,
        unit_id text not null,
        direction text not null,
        state text not null,
        peer text not null,
        at integer not null
      )`,
  `create table imports (
        source text primary key,
        imported_at integer not null
      )`,
]
