import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { main, poster, run } from '../cutover-run'

/** The cutover runner: every bundle posted, the report written, and D1 filled only when clean. */

function bundleDir() {
  const dir = mkdtempSync(join(tmpdir(), 'cutover-'))
  mkdirSync(join(dir, 'accounts'))
  mkdirSync(join(dir, 'games'))
  writeFileSync(join(dir, 'site.json'), JSON.stringify({ site: true }))
  writeFileSync(join(dir, 'accounts', 'd1.json'), JSON.stringify({ discordId: 'd1', name: 'Jrvs' }))
  writeFileSync(
    join(dir, 'games', 'g1.json'),
    JSON.stringify({ gameId: 'g1', members: [{ discordId: 'd1', mediator: true }] })
  )
  writeFileSync(join(dir, 'games', 'notes.txt'), 'not a bundle')
  return dir
}

type Sent = { step: string; body: unknown }

function fakePost(diff: Record<string, string[]> = {}, fail = '') {
  const sent: Sent[] = []
  const post = async (step: string, body: unknown) => {
    sent.push({ step, body })
    if (step === fail) throw new Error('500 boom')
    if (step === 'site') return { written: true }
    if (step === 'finish') return { filled: true }
    return { imported: true, diff: diff[step] ?? [] }
  }
  return { post, sent }
}

describe('run', () => {
  it('posts the site, each account, each Game with its Mediator’s name, then finishes', async () => {
    const { post, sent } = fakePost()
    const report = await run(bundleDir(), post, true)
    expect(sent.map((s) => s.step)).toEqual(['site', 'account', 'game', 'finish'])
    expect(sent[2]?.body).toEqual({
      bundle: { gameId: 'g1', members: [{ discordId: 'd1', mediator: true }] },
      mediatedBy: 'Jrvs',
    })
    expect(report).toEqual({
      site: { written: true },
      rooms: [
        { room: 'account d1', imported: true, diff: [] },
        { room: 'game g1', imported: true, diff: [] },
      ],
      differing: 0,
      filled: true,
    })
  })

  it('does not finish without --finish, or while a room differs or a post fails', async () => {
    expect((await run(bundleDir(), fakePost().post, false)).filled).toBe(false)
    const differs = fakePost({ game: ['links: 1 ≠ 0'] })
    const report = await run(bundleDir(), differs.post, true)
    expect(report.differing).toBe(1)
    expect(differs.sent.some((s) => s.step === 'finish')).toBe(false)
    const fails = await run(bundleDir(), fakePost({}, 'account').post, true)
    expect(fails.rooms[0]).toEqual({ room: 'account d1', diff: ['post failed: 500 boom'] })
    expect(fails.filled).toBe(false)
  })

  it('a Game whose Mediator has no account bundle goes with no name', async () => {
    const dir = bundleDir()
    writeFileSync(join(dir, 'accounts', 'd1.json'), JSON.stringify({ discordId: 'd9', name: 'X' }))
    const { post, sent } = fakePost()
    await run(dir, post, false)
    expect(sent[2]?.body).toMatchObject({ mediatedBy: null })
  })
})

describe('poster', () => {
  it('posts JSON with the secret, and fails on any answer but 200', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const answer = { ok: true, status: 200 }
    const fetchImpl = (async (url: URL, init: RequestInit) => {
      calls.push({ url: String(url), init })
      return answer.ok
        ? new Response(JSON.stringify({ filled: true }))
        : new Response('nope', { status: answer.status })
    }) as unknown as typeof fetch
    const post = poster('https://pr-1.example', 's3cret', fetchImpl)
    expect(await post('finish', {})).toEqual({ filled: true })
    expect(calls[0]?.url).toBe('https://pr-1.example/admin/cutover/finish')
    expect(new Headers(calls[0]?.init.headers).get('authorization')).toBe('Bearer s3cret')
    answer.ok = false
    answer.status = 401
    await expect(post('site', {})).rejects.toThrow('site: 401 nope')
  })

  it('posts again when the connection drops before an answer, up to three tries', async () => {
    let calls = 0
    let drops = 2
    const fetchImpl = (async () => {
      calls++
      if (drops-- > 0) throw new Error('The socket connection was closed unexpectedly.')
      return new Response(JSON.stringify({ imported: true, diff: [] }))
    }) as unknown as typeof fetch
    const waits: number[] = []
    const post = poster('https://pr-1.example', 's3cret', fetchImpl, async (ms) => {
      waits.push(ms)
    })
    expect(await post('account', {})).toEqual({ imported: true, diff: [] })
    expect(calls).toBe(3)
    expect(waits).toEqual([500, 1000])
    drops = 3
    await expect(post('account', {})).rejects.toThrow('closed unexpectedly')
  })
})

describe('main', () => {
  it('needs a directory, an origin and the secret', async () => {
    expect(await main([], {})).toBe(1)
    expect(await main(['dir', 'https://x.example'], {})).toBe(1)
  })

  it('writes report.json and exits 1 when a room differs', async () => {
    const dir = bundleDir()
    const fetchImpl = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ imported: true, diff: ['body differs'] })
      )) as unknown as typeof fetch
    try {
      expect(await main([dir, 'https://x.example', '--finish'], { CUTOVER_SECRET: 's' })).toBe(1)
    } finally {
      globalThis.fetch = fetchImpl
    }
    const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'))
    expect(report.differing).toBe(2)
    expect(report.filled).toBe(false)
  })
})
