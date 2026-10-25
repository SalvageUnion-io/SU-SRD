/**
 * Public sheets in the shared database (ADR-032): one row per thing
 * shared by link, written by the room that holds it.
 *
 * - **Shared is a row.** The room writes the row when its owner shares the
 *   thing and on every change after; unsharing deletes it at once
 *   (`dropPublicSheet`). Private and missing are the same absent row.
 * - **What a stranger may see, decided by the writer.** `page` and `preview`
 *   are worked out by the room that holds the thing, with its links and
 *   assignments in reach, so this module serves them as written and decides
 *   nothing.
 * - **No listing.** Reads take a kind and an address; nothing enumerates.
 */

import { parseShareSegment } from 'game-domain/shareAddress'
import type { PreviewAnswer, PreviewKind } from '../../lib/linkPreview/previewSummary'
import type { SharedDb } from './db'
import { parseJson } from './db'

/** One shared thing, as its room writes it. */
export type PublicSheetRow = {
  kind: PreviewKind
  appId: string
  /** The account that owns or made it; null for a Game's unowned crawler. */
  ownerId: string | null
  /** What its `/p/` page serves a stranger: `publicSheet.get`'s or `.pattern`'s answer. */
  page: unknown
  /** What its link preview says. */
  preview: PreviewAnswer
}

/** Rows a short address's prefix can match before the lookup stops looking. */
const PREFIX_MATCH_CAP = 8

/** Write a shared thing's row, or replace it: the room calls this on every change. */
export async function putPublicSheet(db: SharedDb, row: PublicSheetRow, now = Date.now()) {
  await db
    .prepare(
      `insert into public_sheets (kind, app_id, owner_id, page, preview, created_at, updated_at)
       values (?1, ?2, ?3, ?4, ?5, ?6, ?6)
       on conflict (kind, app_id) do update set
         owner_id = excluded.owner_id, page = excluded.page,
         preview = excluded.preview, updated_at = excluded.updated_at`
    )
    .bind(
      row.kind,
      row.appId,
      row.ownerId,
      JSON.stringify(row.page),
      JSON.stringify(row.preview),
      now
    )
    .run()
}

/** Unshare: the row goes, so every link to it reads as missing at once. */
export async function dropPublicSheet(db: SharedDb, kind: PreviewKind, appId: string) {
  await db
    .prepare('delete from public_sheets where kind = ?1 and app_id = ?2')
    .bind(kind, appId)
    .run()
}

type Columns = { page: string; preview: string }

/**
 * The row an address segment names (`game-domain/shareAddress`): a short
 * address's prefix, else the whole segment as an app id; the oldest row when
 * a prefix matches two.
 */
async function rowByAddress(
  db: SharedDb,
  kind: PreviewKind,
  segment: string
): Promise<Columns | null> {
  const parsed = parseShareSegment(segment)
  if (parsed.kind === 'prefix') {
    const { results } = await db
      .prepare(
        `select page, preview from public_sheets
         where kind = ?1 and app_id >= ?2 and app_id < ?3
         order by created_at limit ${PREFIX_MATCH_CAP}`
      )
      .bind(kind, parsed.prefix, `${parsed.prefix}\uffff`)
      .all<Columns>()
    if (results[0]) return results[0]
  }
  return db
    .prepare('select page, preview from public_sheets where kind = ?1 and app_id = ?2')
    .bind(kind, segment)
    .first<Columns>()
}

/** One shared thing's link preview, or null when it is not shared. */
export async function publicPreview(
  db: SharedDb,
  kind: PreviewKind,
  segment: string
): Promise<PreviewAnswer | null> {
  const row = await rowByAddress(db, kind, segment)
  return row ? parseJson<PreviewAnswer>(row.preview) : null
}

/** One shared thing's page, as a stranger reads it, or null when it is not shared. */
export async function publicPage(
  db: SharedDb,
  kind: PreviewKind,
  segment: string
): Promise<unknown> {
  const row = await rowByAddress(db, kind, segment)
  return row ? parseJson<unknown>(row.page) : null
}
