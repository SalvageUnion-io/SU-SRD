import { describe, expect, it } from 'bun:test'
import { FEEDBACK_DAILY_LIMIT, FEEDBACK_MAX } from 'game-domain/feedback'
import type { FeedbackNote } from '../feedback'
import { acceptFeedback, dropFeedbackOf, sweepFeedback } from '../feedback'
import { testDb } from './d1'

/** Feedback waits in the shared database, then the hourly cron files it (ADR-057). */

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 25, 12)

const note = (over: Partial<FeedbackNote> = {}): FeedbackNote => ({
  sender: 'user:u-1',
  source: 'app',
  kind: 'report',
  text: 'The Mule page lists no systems.',
  page: '/chassis/mule/',
  ...over,
})

/** A stand-in GitHub that numbers each issue it opens upward from a hundred, or refuses every one. */
function github(ok = true) {
  const posted: { url: string; body: { title: string; labels: string[] } }[] = []
  const fetchImpl = async (url: string, init?: RequestInit) => {
    posted.push({ url, body: JSON.parse(String(init?.body)) })
    return ok
      ? Response.json({ number: 99 + posted.length }, { status: 201 })
      : new Response('no', { status: 403 })
  }
  return { fetchImpl, posted }
}

const rows = (db: ReturnType<typeof testDb>) =>
  db.sqlite.query('select id, text, issue, attempts from feedback order by id').all()

describe('acceptFeedback', () => {
  it('holds a note to its bounds and five a day per sender', async () => {
    const db = testDb()
    expect(await acceptFeedback(db, note({ text: '  too short ' }), NOW)).toBe('short')
    expect(await acceptFeedback(db, note({ text: 'x'.repeat(FEEDBACK_MAX + 1) }), NOW)).toBe('long')
    for (let i = 0; i < FEEDBACK_DAILY_LIMIT; i += 1) {
      expect(await acceptFeedback(db, note(), NOW + i)).toBeNull()
    }
    expect(await acceptFeedback(db, note(), NOW + 10)).toBe('limit')
    expect(await acceptFeedback(db, note({ sender: 'discord:42', source: 'bot' }), NOW)).toBeNull()
    // A day on, the sender may send again.
    expect(await acceptFeedback(db, note(), NOW + DAY + 10)).toBeNull()
  })
})

describe('sweepFeedback', () => {
  it('files each waiting note once, then drops its text', async () => {
    const db = testDb()
    await acceptFeedback(db, note(), NOW)
    await acceptFeedback(db, note({ kind: 'suggestion', text: 'Add a dark theme please.' }), NOW)
    const gh = github()
    expect(await sweepFeedback(db, 'token', gh.fetchImpl, NOW + 1)).toEqual({
      filed: 2,
      failed: 0,
      dropped: 0,
    })
    expect(gh.posted.map((p) => [p.url, p.body.labels])).toEqual([
      ['https://api.github.com/repos/SalvageUnion-io/SU-SRD/issues', ['feedback', 'bug']],
      ['https://api.github.com/repos/SalvageUnion-io/SU-SRD/issues', ['feedback', 'enhancement']],
    ])
    expect(rows(db)).toEqual([
      { id: 1, text: null, issue: 100, attempts: 0 },
      { id: 2, text: null, issue: 101, attempts: 0 },
    ])
    await sweepFeedback(db, 'token', gh.fetchImpl, NOW + 2)
    expect(gh.posted).toHaveLength(2)
  })

  it('without a token files nothing, and a refusal counts an attempt and waits', async () => {
    const db = testDb()
    await acceptFeedback(db, note(), NOW)
    const gh = github(false)
    expect((await sweepFeedback(db, undefined, gh.fetchImpl, NOW)).filed).toBe(0)
    expect(gh.posted).toHaveLength(0)
    expect(await sweepFeedback(db, 'token', gh.fetchImpl, NOW)).toMatchObject({ failed: 1 })
    expect(rows(db)).toEqual([
      { id: 1, text: 'The Mule page lists no systems.', issue: null, attempts: 1 },
    ])
  })

  it('never files a note another sweep holds', async () => {
    const db = testDb()
    await acceptFeedback(db, note(), NOW)
    db.sqlite.query('update feedback set filing_since = ?1').run(NOW)
    const gh = github()
    await sweepFeedback(db, 'token', gh.fetchImpl, NOW + 60_000)
    expect(gh.posted).toHaveLength(0)
    await sweepFeedback(db, 'token', gh.fetchImpl, NOW + 16 * 60_000)
    expect(gh.posted).toHaveLength(1)
  })

  it('deletes a filed row a day old and a note a week unfiled', async () => {
    const db = testDb()
    await acceptFeedback(db, note(), NOW)
    await sweepFeedback(db, 'token', github().fetchImpl, NOW)
    await acceptFeedback(db, note({ sender: 'user:u-2' }), NOW)
    expect((await sweepFeedback(db, undefined, fetch, NOW + DAY + 1)).dropped).toBe(1)
    expect((await sweepFeedback(db, undefined, fetch, NOW + 7 * DAY + 1)).dropped).toBe(1)
    expect(rows(db)).toEqual([])
  })

  it("an account's going takes its notes", async () => {
    const db = testDb()
    await acceptFeedback(db, note(), NOW)
    await acceptFeedback(db, note({ sender: 'discord:42', source: 'bot' }), NOW)
    await acceptFeedback(db, note({ sender: 'user:u-2' }), NOW)
    await dropFeedbackOf(db, ['user:u-1', 'discord:42'])
    expect(rows(db)).toHaveLength(1)
  })
})
