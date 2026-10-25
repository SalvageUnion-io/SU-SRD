/**
 * A Game room's tables: one Durable Object per Game holds everything
 * Convex kept under that `gameId`.
 *
 * - `game`: the one row naming it, its primary crawler (ADR-037), and when
 *   its Organizer began ending it.
 * - `members`: the roster and roles (ADR-030 §3), with the name and avatar a
 *   roster shows, refreshed by the member's account room.
 * - `invites`: the Game's invite codes; the newest open one is its URL.
 * - `units`: its pilots, mechs, crawlers and built NPCs, each a snapshot at
 *   `head_seq` (ADR-063). `owner_id` is the member it is assigned to, null
 *   for an unassigned unit or a crawler (communal, ADR-030 §5). `lease_id` is
 *   set while the unit is on its way out (`handoff.ts`).
 * - `ops`: every unit's op log, applied, proposed and declined.
 * - `links`: the assignments between units (ADR-037, ADR-044).
 * - `seats`: each pilot's play state (ADR-038 §2).
 * - `downtime_run`: the Game's Downtime, while one runs.
 * - `tray` and `running_encounter`: the Mediator's Opposition and the
 *   encounter being run, read by nobody else (ADR-059 §4).
 * - `leases`: handoffs in and out, so each is accepted once and refused for good.
 * - `imports`: the cutover copies already taken in, so a rerun takes nothing twice.
 *
 * Presence and the roll feed are their own step's, in their own tables; the
 * Scene, salvage area, ledger and Safety Protocols are step 3's.
 */
/** Step 1 of `GAME_ROOM` (`../schemas.ts`). */
export const GAME_ROOM_TABLES: readonly string[] = [
  `create table game (
        id integer primary key check (id = 1),
        game_id text not null,
        name text not null,
        template_origin text,
        primary_crawler_id text,
        created_at integer not null,
        disbanding_at integer
      )`,
  `create table members (
        user_id text primary key,
        mediator integer not null,
        organizer integer not null,
        joined_at integer not null,
        display_name text,
        avatar_url text
      )`,
  `create table invites (
        code text primary key,
        created_by text not null,
        created_at integer not null,
        revoked_at integer
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
  'create index units_owner on units (owner_id)',
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
  'create index ops_state_unit on ops (state, unit_id)',
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
        updated_at integer not null
      )`,
  `create table downtime_run (
        id integer primary key check (id = 1),
        run_id text not null,
        step_index integer not null,
        started_at integer not null,
        completed_by text not null,
        upkeep_spent integer not null
      )`,
  `create table tray (
        id text primary key,
        body text not null,
        added_at integer not null
      )`,
  `create table running_encounter (
        id integer primary key check (id = 1),
        body text not null
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

/**
 * Step 2 of `GAME_ROOM`: when each link was drawn and each tray NPC last
 * changed, which the socket's links and records carry (`../protocol.ts`).
 */
export const GAME_ROOM_STAMPS: readonly string[] = [
  'alter table links add column created_at integer not null default 0',
  'alter table tray add column updated_at integer not null default 0',
]

/**
 * Step 3 of `GAME_ROOM`: what the table plays under, beside its units.
 *
 * - `scene`: the Scene's conditions and the hours passed under them.
 * - `salvage_area`: the area the table is salvaging, at most one.
 * - `ledger`: the Game's factions and jobs, one `LedgerSchema` body.
 * - `boundaries` and `stop_sign`: the Safety Protocols. Who added a boundary
 *   or showed the Stop Sign is kept so they can take it back, and never shown.
 */
export const GAME_ROOM_TABLE_STATE: readonly string[] = [
  `create table scene (
        id integer primary key check (id = 1),
        conditions text not null,
        hours integer not null,
        updated_at integer not null
      )`,
  `create table salvage_area (
        id integer primary key check (id = 1),
        name text not null,
        tech_level integer not null,
        supply integer not null,
        updated_at integer not null
      )`,
  `create table ledger (
        id integer primary key check (id = 1),
        body text not null
      )`,
  `create table boundaries (
        id text primary key,
        kind text not null,
        text text not null,
        added_by text not null,
        added_at integer not null
      )`,
  'create index boundaries_added on boundaries (added_at)',
  `create table stop_sign (
        id integer primary key check (id = 1),
        shown_by text,
        shown_at integer,
        post_to_channel integer not null default 0,
        posted_at integer
      )`,
]
