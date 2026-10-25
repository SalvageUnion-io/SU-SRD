/**
 * Homebrew in the shared database (ADR-061): the listing the SRD's
 * pages read, and its reports and takedowns.
 *
 * - **Listed is a row.** A pattern's account room writes it while the
 *   pattern is shared by link AND on the Reference, and drops it when either
 *   opt-in goes (`putHomebrew`, `dropHomebrew`).
 * - **Hidden outlives sharing.** A takedown is its own row
 *   (`homebrew_moderation`), so unsharing and sharing again does not undo it.
 * - **Who may** report or moderate is the caller's to check (a signed-in
 *   reader, a site admin); these functions keep the rows.
 */

import type { HomebrewRow } from '../../lib/homebrew/endpoint'
import type { SharedDb } from './db'
import { parseJson } from './db'

/** The most patterns one read returns, newest share first. */
const HOMEBREW_LIMIT = 500

/** A report's reason, at most this long once trimmed. */
export const REPORT_REASON_MAX = 500

/** The most reasons one moderated pattern carries back. */
const REASONS_SHOWN = 10

/** The most patterns either moderation list carries. */
const MODERATION_LIMIT = 100

/** One listed pattern, as its account room writes it: its body already parsed. */
export type HomebrewListing = {
  appId: string
  ownerId: string
  chassisRef: string | null
  /** What it calls itself, for the admin's queue. */
  name: string
  body: unknown
  madeBy: string
  sharedAt: number | null
}

/** List a pattern on the Reference, or update its row. */
export async function putHomebrew(db: SharedDb, row: HomebrewListing) {
  await db
    .prepare(
      `insert into homebrew_patterns (app_id, owner_id, chassis_ref, name, body, made_by, shared_at)
       values (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       on conflict (app_id) do update set
         owner_id = excluded.owner_id, chassis_ref = excluded.chassis_ref, name = excluded.name,
         body = excluded.body, made_by = excluded.made_by, shared_at = excluded.shared_at`
    )
    .bind(
      row.appId,
      row.ownerId,
      row.chassisRef,
      row.name,
      JSON.stringify(row.body),
      row.madeBy,
      row.sharedAt
    )
    .run()
}

/** Take a pattern off the Reference: its maker withdrew a share. Its moderation stays. */
export async function dropHomebrew(db: SharedDb, appId: string) {
  await db.prepare('delete from homebrew_patterns where app_id = ?1').bind(appId).run()
}

type ListedColumns = { app_id: string; body: string; made_by: string; shared_at: number | null }

/** Every listed pattern not hidden, newest share first, or one chassis's. */
export async function homebrewPatterns(db: SharedDb, chassisRef?: string): Promise<HomebrewRow[]> {
  const chassis = chassisRef === undefined ? '' : 'AND p.chassis_ref = ?1'
  const statement = db.prepare(
    `select p.app_id, p.body, p.made_by, p.shared_at from homebrew_patterns p
     left join homebrew_moderation m on m.app_id = p.app_id
     where coalesce(m.hidden, 0) = 0 ${chassis}
     order by p.shared_at desc limit ${HOMEBREW_LIMIT}`
  )
  const { results } = await (chassisRef === undefined
    ? statement
    : statement.bind(chassisRef)
  ).all<ListedColumns>()
  return results.flatMap((row) => {
    const body = parseJson<unknown>(row.body)
    return body === null
      ? []
      : [{ appId: row.app_id, body, madeBy: row.made_by, sharedAt: row.shared_at }]
  })
}

/** Where one pattern stands, for its page: the reader's own report and the takedown. */
export async function homebrewStanding(
  db: SharedDb,
  appId: string,
  readerId: string | null
): Promise<{ listed: boolean; hidden: boolean; reported: boolean; ownerId: string | null }> {
  const row = await db
    .prepare(
      `select p.owner_id, coalesce(m.hidden, 0) as hidden,
         exists (select 1 from homebrew_reports r where r.app_id = p.app_id and r.reporter_id = ?2)
           as reported
       from homebrew_patterns p left join homebrew_moderation m on m.app_id = p.app_id
       where p.app_id = ?1`
    )
    .bind(appId, readerId)
    .first<{ owner_id: string; hidden: number; reported: number }>()
  if (row === null) return { listed: false, hidden: false, reported: false, ownerId: null }
  return {
    listed: row.hidden === 0,
    hidden: row.hidden === 1,
    reported: row.reported === 1,
    ownerId: row.owner_id,
  }
}

/** Why a report was refused, in the words the reader sees. */
export type ReportRefusal = 'not-listed' | 'own' | 'empty' | 'too-long'

/**
 * Report a listed pattern, with a reason. One report per reader: reporting
 * again replaces the reason. Never your own.
 */
export async function reportHomebrew(
  db: SharedDb,
  report: { appId: string; reporterId: string; reason: string },
  now = Date.now()
): Promise<ReportRefusal | null> {
  const owner = await db
    .prepare('select owner_id from homebrew_patterns where app_id = ?1')
    .bind(report.appId)
    .first<{ owner_id: string }>()
  if (owner === null) return 'not-listed'
  if (owner.owner_id === report.reporterId) return 'own'
  const reason = report.reason.trim()
  if (reason.length === 0) return 'empty'
  if (reason.length > REPORT_REASON_MAX) return 'too-long'
  await db
    .prepare(
      `insert into homebrew_reports (app_id, reporter_id, reason, at) values (?1, ?2, ?3, ?4)
       on conflict (app_id, reporter_id) do update set reason = excluded.reason, at = excluded.at`
    )
    .bind(report.appId, report.reporterId, reason, now)
    .run()
  return null
}

/** Hide a pattern, which settles its reports, or put it back. A site admin's act. */
export async function setHomebrewHidden(
  db: SharedDb,
  appId: string,
  hidden: boolean,
  now = Date.now()
) {
  if (!hidden) {
    await db
      .prepare('update homebrew_moderation set hidden = 0, hidden_at = null where app_id = ?1')
      .bind(appId)
      .run()
    return
  }
  await db.batch([
    db.prepare('delete from homebrew_reports where app_id = ?1').bind(appId),
    db
      .prepare(
        `insert into homebrew_moderation (app_id, hidden, hidden_at) values (?1, 1, ?2)
         on conflict (app_id) do update set hidden = 1, hidden_at = excluded.hidden_at`
      )
      .bind(appId, now),
  ])
}

/** Clear a pattern's reports and leave it shown. A site admin's act. */
export async function dismissHomebrewReports(db: SharedDb, appId: string) {
  await db.prepare('delete from homebrew_reports where app_id = ?1').bind(appId).run()
}

/** Every report one account made: the account is going. */
export async function dropReportsBy(db: SharedDb, reporterId: string) {
  await db.prepare('delete from homebrew_reports where reporter_id = ?1').bind(reporterId).run()
}

/** One pattern as a site admin reviews it. */
export type Moderated = {
  appId: string
  name: string
  madeBy: string
  reportCount: number
  /** The newest reasons first. */
  reasons: string[]
  hiddenAt: number | null
}

type ModeratedColumns = {
  app_id: string
  name: string
  made_by: string
  report_count: number
  reasons: string | null
  hidden_at: number | null
}

const MODERATED = `select p.app_id, p.name, p.made_by, m.hidden_at,
    (select count(*) from homebrew_reports r where r.app_id = p.app_id) as report_count,
    (select json_group_array(reason) from (select reason from homebrew_reports r
       where r.app_id = p.app_id order by at desc limit ${REASONS_SHOWN})) as reasons
  from homebrew_patterns p left join homebrew_moderation m on m.app_id = p.app_id`

function moderatedOf(row: ModeratedColumns): Moderated {
  return {
    appId: row.app_id,
    name: row.name,
    madeBy: row.made_by,
    reportCount: row.report_count,
    reasons: parseJson<string[]>(row.reasons) ?? [],
    hiddenAt: row.hidden_at,
  }
}

/**
 * The site admin's queue: listed patterns with open reports, most reported
 * first, and the listed patterns taken down, newest first.
 */
export async function homebrewModeration(
  db: SharedDb
): Promise<{ reported: Moderated[]; hidden: Moderated[] }> {
  const [reported, hidden] = await Promise.all([
    db
      .prepare(
        `select * from (${MODERATED} where coalesce(m.hidden, 0) = 0)
         where report_count > 0 order by report_count desc limit ${MODERATION_LIMIT}`
      )
      .all<ModeratedColumns>(),
    db
      .prepare(
        `${MODERATED} where m.hidden = 1 order by m.hidden_at desc limit ${MODERATION_LIMIT}`
      )
      .all<ModeratedColumns>(),
  ])
  return { reported: reported.results.map(moderatedOf), hidden: hidden.results.map(moderatedOf) }
}
