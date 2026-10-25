/**
 * "Suggest or report" and `/su feedback` in the shared database (ADR-057): a
 * player's note waits here, then the hourly cron files it as a labelled
 * issue on the public SU-SRD repository, with no name on it.
 *
 * A note is written first and filed after, so a GitHub outage or a missing
 * token loses nothing: the next sweep files whatever is still waiting. The
 * text goes once filed, and the row once it is a day old, which is as long
 * as the five-a-day limit needs it.
 */

import type { FEEDBACK_REFUSAL, FeedbackKind, FeedbackSource } from 'game-domain/feedback'
import {
  FEEDBACK_DAILY_LIMIT,
  FEEDBACK_MAX,
  FEEDBACK_MIN,
  FEEDBACK_REPO,
  issueFor,
} from 'game-domain/feedback'
import type { SharedDb } from './db'

const DAY = 86_400_000

/** A note that could not be filed for this long is dropped rather than held. */
const GIVE_UP_AFTER = 7 * DAY

/** How long one filing holds its note: a second sweep never posts it while the first runs. */
const CLAIM_FOR = 15 * 60_000

/** The most notes one sweep files: a backlog drains over a few hours, never in one burst. */
const SWEEP_BATCH = 25

/** One note as it is sent: `sender` is the account or the Discord id, held for the limit alone. */
export type FeedbackNote = {
  sender: string
  source: FeedbackSource
  kind: FeedbackKind
  text: string
  /** The app path it was sent from (`pagePath`), or null. */
  page: string | null
}

/** Why a note was refused: its words for the sender are `FEEDBACK_REFUSAL[reason]`. */
export type FeedbackRefusal = keyof typeof FEEDBACK_REFUSAL

/** Check the note and the sender's day, and write it to wait for the sweep. */
export async function acceptFeedback(
  db: SharedDb,
  note: FeedbackNote,
  now = Date.now()
): Promise<FeedbackRefusal | null> {
  const text = note.text.trim()
  if (text.length < FEEDBACK_MIN) return 'short'
  if (text.length > FEEDBACK_MAX) return 'long'
  const today = await db
    .prepare('select count(*) as n from feedback where sender = ?1 and created_at >= ?2')
    .bind(note.sender, now - DAY)
    .first<{ n: number }>()
  if ((today?.n ?? 0) >= FEEDBACK_DAILY_LIMIT) return 'limit'
  await db
    .prepare(
      `insert into feedback (sender, source, kind, text, page, created_at)
       values (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(note.sender, note.source, note.kind, text, note.page, now)
    .run()
  return null
}

/** Every note one sender sent: the account is going. */
export async function dropFeedbackOf(db: SharedDb, senders: string[]) {
  await db.batch(
    senders.map((sender) => db.prepare('delete from feedback where sender = ?1').bind(sender))
  )
}

type Waiting = {
  id: number
  kind: FeedbackKind
  source: FeedbackSource
  text: string
  page: string | null
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

/** File one note; the issue's number, or null when GitHub refused it. */
async function fileOne(note: Waiting, token: string, fetchImpl: Fetch): Promise<number | null> {
  const response = await fetchImpl(`https://api.github.com/repos/${FEEDBACK_REPO}/issues`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'salvageunion.io feedback',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(issueFor(note)),
  })
  if (!response.ok) return null
  return ((await response.json()) as { number: number }).number
}

/** What one sweep did, for its log line. */
export type SweepResult = { filed: number; failed: number; dropped: number }

/**
 * The hourly sweep: delete filed rows a day old and notes that waited a week,
 * then file what is waiting with `token` (a token that may open issues on
 * `FEEDBACK_REPO`). Without a token nothing is filed and the notes wait.
 */
export async function sweepFeedback(
  db: SharedDb,
  token: string | undefined,
  fetchImpl: Fetch = fetch,
  now = Date.now()
): Promise<SweepResult> {
  const [filedOld, stale] = await db.batch([
    db.prepare('delete from feedback where issue is not null and created_at < ?1').bind(now - DAY),
    db
      .prepare('delete from feedback where issue is null and created_at < ?1')
      .bind(now - GIVE_UP_AFTER),
  ])
  const dropped = changes(filedOld) + changes(stale)
  const result = { filed: 0, failed: 0, dropped }
  if (!token) return result

  const { results } = await db
    .prepare(
      `update feedback set filing_since = ?1
       where id in (select id from feedback where issue is null and text is not null
         and (filing_since is null or filing_since < ?2) order by created_at limit ${SWEEP_BATCH})
       returning id, kind, source, text, page`
    )
    .bind(now, now - CLAIM_FOR)
    .all<Waiting>()
  for (const note of results) {
    const issue = await fileOne(note, token, fetchImpl).catch(() => null)
    if (issue === null) {
      result.failed += 1
      await db
        .prepare('update feedback set attempts = attempts + 1, filing_since = null where id = ?1')
        .bind(note.id)
        .run()
    } else {
      result.filed += 1
      await db
        .prepare('update feedback set issue = ?2, text = null, filing_since = null where id = ?1')
        .bind(note.id, issue)
        .run()
    }
  }
  return result
}

/** The rows a D1 write changed, from its `meta` (bun:sqlite's `changes` in a test). */
function changes(result: unknown): number {
  const r = result as { meta?: { changes?: number }; changes?: number } | undefined
  return r?.meta?.changes ?? r?.changes ?? 0
}
