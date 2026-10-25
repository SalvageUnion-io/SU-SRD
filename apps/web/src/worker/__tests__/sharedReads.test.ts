import { afterEach, describe, expect, it } from 'bun:test'
import { appPath } from '../../lib/appBase'
import { HOMEBREW_PATTERNS_PATH } from '../../lib/homebrew/endpoint'
import { renderShell } from '../../shell/shell'
import { serveHomebrew } from '../homebrew'
import type { Env } from '../index'
import worker from '../index'
import { testDb } from '../shared/__tests__/d1'
import type { SharedDb } from '../shared/db'
import { isFilled, markFilled } from '../shared/db'
import { putGame, putInvite } from '../shared/games'
import { putHomebrew, setHomebrewHidden } from '../shared/homebrew'
import { dropPublicSheet, putPublicSheet } from '../shared/publicSheets'

/**
 * The Worker's reads move to the shared database once the cutover marks it
 * filled, and not before: until then Convex answers, so nothing reads an
 * empty table.
 */

const SHELL = renderShell()
const CONVEX_URL = 'https://convex.example'
const PILOT = {
  kind: 'pilot',
  body: { id: 'p-1', name: 'Rosa Vance', callsign: 'Bonesaw', classRef: 'engineer' },
  ownerName: 'Rosa',
  gameName: 'Reclamation of the Wastes',
}
const TOW_RIG = {
  appId: 'pat-1',
  ownerId: 'maker',
  chassisRef: 'mule',
  name: 'Tow Rig',
  body: { name: 'Tow Rig' },
  madeBy: 'Rosa',
  sharedAt: 1,
}

/** Every Convex call the fake network saw; it answers each with null. */
let asked: string[] = []
const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})
function convexAnswersNull() {
  asked = []
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    asked.push((JSON.parse(String(init?.body)) as { path: string }).path)
    return Response.json({ status: 'success', value: null })
  }) as unknown as typeof fetch
}

async function filled() {
  const db = testDb()
  await putPublicSheet(db, {
    kind: 'pilot',
    appId: 'p-1',
    ownerId: 'u-1',
    page: {},
    preview: PILOT as never,
  })
  await putGame(db, { gameId: 'g-1', name: 'Reclamation of the Wastes', mediatedBy: 'Jrvs' })
  await putInvite(db, 'g-1', 'K7QR2XA')
  await putHomebrew(db, TOW_RIG)
  await markFilled(db)
  return db
}

const env = (SHARED?: SharedDb): Env =>
  ({
    ASSETS: {
      fetch: async () => new Response(SHELL, { headers: { 'content-type': 'text/html' } }),
    },
    CONVEX_URL,
    SHARED,
  }) as unknown as Env

const discordbot = (path: string) =>
  new Request(`https://salvageunion.io${appPath(path)}`, {
    headers: { 'user-agent': 'Discordbot/2.0' },
  })

const title = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1]

describe('isFilled', () => {
  it('is false with no database, an empty one or a failing one', async () => {
    expect(await isFilled(undefined)).toBe(false)
    expect(await isFilled(testDb())).toBe(false)
    const down = {
      prepare() {
        throw new Error('D1 is down')
      },
      batch: async () => [],
    }
    expect(await isFilled(down)).toBe(false)
    expect(await isFilled(await filled())).toBe(true)
  })
})

describe('link previews', () => {
  it('read Convex while the shared database is not filled', async () => {
    convexAnswersNull()
    await worker.fetch(discordbot('/p/pilot/p-1'), env(testDb()))
    expect(asked).toEqual(['publicSheet:preview'])
  })

  it('read the shared database once it is, and never Convex', async () => {
    convexAnswersNull()
    const db = await filled()
    expect(title(await (await worker.fetch(discordbot('/p/pilot/p-1'), env(db))).text())).toBe(
      'Bonesaw'
    )
    expect(
      title(await (await worker.fetch(discordbot('/play/invite/K7QR2XA'), env(db))).text())
    ).toBe('Reclamation of the Wastes')
    await dropPublicSheet(db, 'pilot', 'p-1')
    expect(title(await (await worker.fetch(discordbot('/p/pilot/p-1'), env(db))).text())).toBe(
      'Private'
    )
    expect(asked).toEqual([])
  })
})

describe('Homebrew', () => {
  const at = (query = '') => new URL(`https://x${HOMEBREW_PATTERNS_PATH}${query}`)

  it('reads the shared database once it is filled, hidden patterns left out', async () => {
    convexAnswersNull()
    const db = await filled()
    const res = await serveHomebrew(at('?chassis=mule'), env(db))
    expect(res.headers.get('cache-control')).toBe('public,max-age=60')
    expect(await res.json()).toEqual([
      { appId: 'pat-1', body: { name: 'Tow Rig' }, madeBy: 'Rosa', sharedAt: 1 },
    ])
    await setHomebrewHidden(db, 'pat-1', true)
    expect(await (await serveHomebrew(at(), env(db))).json()).toEqual([])
    expect(asked).toEqual([])
  })

  it('answers 503, uncached, when a filled database fails mid-read', async () => {
    const db = await filled()
    db.sqlite.exec('drop table homebrew_patterns')
    const res = await serveHomebrew(at(), env(db))
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
