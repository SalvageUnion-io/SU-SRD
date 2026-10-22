import { afterEach, describe, expect, test } from 'bun:test'
import { api, internal } from '../../../convex/_generated/api'
import {
  FEEDBACK_DAILY_LIMIT,
  FEEDBACK_REFUSAL,
  issueFor,
  quoteNote,
} from '../../../convex/feedback'
import { makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * "Suggest or report" and `/su feedback` (ADR-054): a note is held only until
 * it is filed as a GitHub issue, carries no name, and one sender gets a few a day.
 */

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.GITHUB_FEEDBACK_TOKEN
})

const NOTE = 'The Mule page shows the wrong Heat Capacity'

describe('sending a note', () => {
  test('the app takes a note from a signed-in player, and nobody else', async () => {
    const t = testConvex()
    const player = await makeUser(t, 'Player')
    await player.as.mutation(api.feedback.submit, { kind: 'report', text: NOTE, page: '/build/' })
    const rows = await t.run((ctx) => ctx.db.query('feedback').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ source: 'app', kind: 'report', text: NOTE, issue: null })
    await expect(t.mutation(api.feedback.submit, { kind: 'report', text: NOTE })).rejects.toThrow()
  })

  test('a note too short or too long is refused in words the sender can act on', async () => {
    const t = testConvex()
    const player = await makeUser(t, 'Player')
    await expect(
      player.as.mutation(api.feedback.submit, { kind: 'suggestion', text: 'hi' })
    ).rejects.toThrow(FEEDBACK_REFUSAL.short)
    await expect(
      player.as.mutation(api.feedback.submit, { kind: 'suggestion', text: 'x'.repeat(2001) })
    ).rejects.toThrow(FEEDBACK_REFUSAL.long)
  })

  test('one sender gets a few a day, from the app or from Discord', async () => {
    const t = testConvex()
    const player = await makeUser(t, 'Player')
    for (let i = 0; i < FEEDBACK_DAILY_LIMIT; i += 1) {
      await player.as.mutation(api.feedback.submit, { kind: 'suggestion', text: `${NOTE} ${i}` })
    }
    await expect(
      player.as.mutation(api.feedback.submit, { kind: 'suggestion', text: NOTE })
    ).rejects.toThrow(FEEDBACK_REFUSAL.limit)

    for (let i = 0; i < FEEDBACK_DAILY_LIMIT; i += 1) {
      const sent = await t.mutation(internal.feedback.fromBot, {
        discordId: 'd-1',
        kind: 'report',
        text: `${NOTE} ${i}`,
      })
      expect(sent.accepted).toBe(true)
    }
    // The bot is told, rather than thrown at, so it can say why.
    expect(
      await t.mutation(internal.feedback.fromBot, { discordId: 'd-1', kind: 'report', text: NOTE })
    ).toEqual({ ok: true, accepted: false, message: FEEDBACK_REFUSAL.limit })
  })
})

describe('filing a note', () => {
  test('files a labelled issue with no name on it, then forgets the words', async () => {
    const t = testConvex()
    const player = await makeUser(t, 'Ada Lovelace')
    await player.as.mutation(api.feedback.submit, { kind: 'report', text: NOTE, page: '/build/' })
    const [row] = await t.run((ctx) => ctx.db.query('feedback').collect())
    if (row === undefined) throw new Error('no row')

    process.env.GITHUB_FEEDBACK_TOKEN = 'token'
    const sent: Array<{ url: string; body: { title: string; body: string; labels: string[] } }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      sent.push({ url: String(url), body: JSON.parse(String(init?.body)) })
      return Response.json({ number: 42 }, { status: 201 })
    }) as typeof fetch

    await t.action(internal.feedback.file, { id: row._id })
    expect(sent.map((s) => s.url)).toEqual([
      'https://api.github.com/repos/SalvageUnion-io/SU-SRD/issues',
    ])
    const issue = sent[0]?.body
    if (issue === undefined) throw new Error('nothing sent')
    expect(issue.labels).toEqual(['feedback', 'bug'])
    expect(issue.title).toStartWith('Report: The Mule page')
    expect(issue.body).not.toContain('Ada')
    const after = await t.run((ctx) => ctx.db.get(row._id))
    expect(after).toMatchObject({ issue: 42, text: null })
  })

  test('with no token the note waits, untouched, for the sweep', async () => {
    const t = testConvex()
    const player = await makeUser(t, 'Player')
    await player.as.mutation(api.feedback.submit, { kind: 'suggestion', text: NOTE })
    const [row] = await t.run((ctx) => ctx.db.query('feedback').collect())
    if (row === undefined) throw new Error('no row')
    await t.action(internal.feedback.file, { id: row._id })
    expect(await t.run((ctx) => ctx.db.get(row._id))).toMatchObject({ issue: null, text: NOTE })
  })

  test('deleting an account deletes its notes', async () => {
    const t = testConvex()
    const player = await makeUser(t, 'Player', 'd-player')
    await player.as.mutation(api.feedback.submit, { kind: 'suggestion', text: NOTE })
    await t.mutation(internal.feedback.fromBot, {
      discordId: 'd-player',
      kind: 'report',
      text: NOTE,
    })
    await player.as.mutation(api.account.deleteAccount, {})
    expect(await t.run((ctx) => ctx.db.query('feedback').collect())).toEqual([])
  })
})

describe('the issue a note becomes', () => {
  test('a stranger’s words cannot mention anybody or link an issue', () => {
    const quoted = quoteNote('@alxjrvs see #12\nsecond line')
    expect(quoted).not.toMatch(/@alxjrvs/)
    expect(quoted).not.toMatch(/#12/)
    expect(quoted.split('\n').every((line) => line.startsWith('> '))).toBe(true)
  })

  test('a suggestion is an enhancement, and a long first line is cut for the title', () => {
    const issue = issueFor({ kind: 'suggestion', source: 'bot', text: 'a'.repeat(200), page: null })
    expect(issue.labels).toEqual(['feedback', 'enhancement'])
    expect(issue.title.length).toBeLessThanOrEqual('Suggestion: '.length + 70)
    expect(issue.body).toContain('/su feedback')
  })
})
