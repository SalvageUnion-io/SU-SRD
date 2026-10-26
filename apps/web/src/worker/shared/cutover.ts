/**
 * The cutover's D1 rows : what each imported bundle puts in the
 * shared database, the rows a room would have written had it held the data
 * all along. Every write is an upsert, so running the copy again changes
 * nothing; the site's rows, which have no natural key to upsert on, are
 * written once (`cutover:site` in `shared_meta`).
 *
 * Public sheets and the homebrew listing are not here: the room that holds
 * the thing works their rows out, and the door asks it to (`republish`).
 */

import type { AccountBundle, GameBundle, SiteBundle } from 'game-domain/migration/bundle'
import type { SharedDb, SharedStatement } from './db'
import { flag } from './db'

/** A binding as `tools/convex-copy.ts` carries it: Convex's row, `boundBy` a Discord id. */
type BundleBinding = Record<string, unknown>

/** The `shared_meta` key that marks the site's rows written. */
const SITE_DONE = 'cutover:site'

function bindingRow(db: SharedDb, b: BundleBinding, gameId: string | null): SharedStatement | null {
  const channelId = typeof b.channelId === 'string' ? b.channelId : null
  const boundBy = typeof b.boundBy === 'string' ? b.boundBy : null
  if (channelId === null || boundBy === null) return null
  return db
    .prepare(
      `insert into channel_bindings (channel_id, game_id, bound_by, channel_name, bound_at)
       values (?1, ?2, ?3, ?4, ?5)
       on conflict (channel_id) do update set game_id = excluded.game_id,
         bound_by = excluded.bound_by, channel_name = excluded.channel_name,
         bound_at = excluded.bound_at`
    )
    .bind(
      channelId,
      gameId,
      boundBy,
      typeof b.channelName === 'string' ? b.channelName : null,
      typeof b.boundAt === 'number' ? b.boundAt : 0
    )
}

/** An account's rows: its totals and its solo channel binding. */
export async function projectAccount(db: SharedDb, bundle: AccountBundle, at: number) {
  const count = (kind: string) => bundle.units.filter((u) => u.kind === kind).length
  const statements = [
    db
      .prepare(
        `insert into account_totals
           (discord_id, pilots, mechs, crawlers, npcs, patterns, updated_at)
         values (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         on conflict (discord_id) do update set pilots = excluded.pilots,
           mechs = excluded.mechs, crawlers = excluded.crawlers, npcs = excluded.npcs,
           patterns = excluded.patterns, updated_at = excluded.updated_at`
      )
      .bind(
        bundle.discordId,
        count('pilot'),
        count('mech'),
        count('crawler'),
        count('npc'),
        bundle.patterns.length,
        at
      ),
    ...bundle.channelBindings.flatMap((b) => bindingRow(db, b, null) ?? []),
  ]
  await db.batch(statements)
}

/** A Game's rows: its name and Mediator, its members, its invite and its channel. */
export async function projectGame(
  db: SharedDb,
  bundle: GameBundle,
  mediatedBy: string | null,
  at: number
) {
  const statements = [
    db
      .prepare(
        `insert into games (game_id, name, mediated_by, updated_at) values (?1, ?2, ?3, ?4)
         on conflict (game_id) do update set name = excluded.name,
           mediated_by = excluded.mediated_by, updated_at = excluded.updated_at`
      )
      .bind(bundle.gameId, bundle.name, mediatedBy, at),
    ...bundle.members.map((m) =>
      db
        .prepare(
          `insert into memberships (game_id, discord_id, mediator, organizer)
           values (?1, ?2, ?3, ?4)
           on conflict (game_id, discord_id) do update set
             mediator = excluded.mediator, organizer = excluded.organizer`
        )
        .bind(bundle.gameId, m.discordId, flag(m.mediator), flag(m.organizer))
    ),
    db.prepare('delete from invites where game_id = ?1').bind(bundle.gameId),
    ...(bundle.inviteCode === null
      ? []
      : [
          db
            .prepare('insert into invites (code, game_id, created_at) values (?1, ?2, ?3)')
            .bind(bundle.inviteCode, bundle.gameId, at),
        ]),
    ...bundle.channelBindings.flatMap((b) => bindingRow(db, b, bundle.gameId) ?? []),
  ]
  await db.batch(statements)
}

/**
 * The site's rows: homebrew reports and takedowns, the signals, and the
 * feedback still waiting to be filed. Written once; false when they already were.
 */
export async function projectSite(db: SharedDb, site: SiteBundle, at: number): Promise<boolean> {
  const done = await db
    .prepare('select 1 as done from shared_meta where key = ?1')
    .bind(SITE_DONE)
    .first()
  if (done !== null) return false
  const waiting = site.feedback.filter(
    (f) => f.issue === null && typeof f.text === 'string' && typeof f.sender === 'string'
  )
  await db.batch([
    ...site.homebrewReports.map((r) =>
      db
        .prepare(
          `insert into homebrew_reports (app_id, reporter_id, reason, at) values (?1, ?2, ?3, ?4)
           on conflict (app_id, reporter_id) do nothing`
        )
        .bind(r.patternAppId, r.reporter, r.reason, r.at)
    ),
    ...site.homebrewHidden.map((h) =>
      db
        .prepare(
          `insert into homebrew_moderation (app_id, hidden, hidden_at) values (?1, 1, ?2)
           on conflict (app_id) do nothing`
        )
        .bind(h.patternAppId, h.hiddenAt)
    ),
    ...site.usageCounts.map((u) =>
      db
        .prepare(
          `insert into usage_counts (key, week_start, count) values (?1, ?2, ?3)
           on conflict (key, week_start) do nothing`
        )
        .bind(u.key, u.weekStart, u.count)
    ),
    ...site.botGuilds.map((g) =>
      db
        .prepare(
          `insert into bot_guilds (guild_id, first_seen_at, last_seen_at) values (?1, ?2, ?3)
           on conflict (guild_id) do nothing`
        )
        .bind(g.guildId, g.firstSeenAt, g.lastSeenAt)
    ),
    ...site.metricsSnapshots.flatMap((s) =>
      typeof s.takenAt === 'number'
        ? [
            db
              .prepare(
                `insert into metrics_snapshots (taken_at, counts) values (?1, ?2)
                 on conflict (taken_at) do nothing`
              )
              .bind(s.takenAt, JSON.stringify(s.counts ?? {})),
          ]
        : []
    ),
    ...waiting.map((f) =>
      db
        .prepare(
          `insert into feedback (sender, source, kind, text, page, created_at, attempts)
           values (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        )
        .bind(
          f.sender,
          f.source,
          f.kind,
          f.text,
          typeof f.page === 'string' ? f.page : null,
          typeof f.createdAt === 'number' ? f.createdAt : at,
          typeof f.attempts === 'number' ? f.attempts : 0
        )
    ),
    db.prepare('insert into shared_meta (key, value) values (?1, ?2)').bind(SITE_DONE, String(at)),
  ])
  return true
}
