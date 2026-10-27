import { describe, expect, it } from 'bun:test'
import { appPath } from '../../lib/appBase'
import { HOMEBREW_PATTERNS_PATH } from '../../lib/homebrew/endpoint'
import { renderShell } from '../../shell/shell'
import type { Env } from '../env'
import { serveHomebrew } from '../homebrew'
import { publish, publishGame, testDb } from '../shared/__tests__/d1'
import type { SharedDb } from '../shared/db'
import { setHomebrewHidden } from '../shared/homebrew'
import { worker } from './worker'

/**
 * The Worker's public reads, end to end on the shared database: link previews
 * and Homebrew.
 */

const SHELL = renderShell()
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

async function seeded() {
  const db = testDb()
  await publish(db, 'account:u-1', {
    sheets: [{ kind: 'pilot', appId: 'p-1', ownerId: 'u-1', page: {}, preview: PILOT as never }],
  })
  await publishGame(db, 'g-1', {
    name: 'Reclamation of the Wastes',
    mediatedBy: 'Jrvs',
    invite: 'K7QR2XA',
  })
  await publish(db, 'account:maker', { homebrew: [TOW_RIG] }, 'maker')
  return db
}

const env = (SHARED?: SharedDb): Env =>
  ({
    ASSETS: {
      fetch: async () => new Response(SHELL, { headers: { 'content-type': 'text/html' } }),
    },
    SHARED,
  }) as unknown as Env

const discordbot = (path: string) =>
  new Request(`https://salvageunion.io${appPath(path)}`, {
    headers: { 'user-agent': 'Discordbot/2.0' },
  })

const title = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1]

describe('link previews', () => {
  it('read the shared database', async () => {
    const db = await seeded()
    expect(title(await (await worker.fetch(discordbot('/p/pilot/p-1'), env(db))).text())).toBe(
      'Bonesaw'
    )
    expect(
      title(await (await worker.fetch(discordbot('/play/invite/K7QR2XA'), env(db))).text())
    ).toBe('Reclamation of the Wastes')
    await publish(db, 'account:u-1', {})
    expect(title(await (await worker.fetch(discordbot('/p/pilot/p-1'), env(db))).text())).toBe(
      'Private'
    )
  })
})

describe('Homebrew', () => {
  const at = (query = '') => new URL(`https://x${HOMEBREW_PATTERNS_PATH}${query}`)

  it('reads the shared database, hidden patterns left out', async () => {
    const db = await seeded()
    const res = await serveHomebrew(at('?chassis=mule'), env(db))
    expect(res.headers.get('cache-control')).toBe('public,max-age=60')
    expect(await res.json()).toEqual([
      { appId: 'pat-1', body: { name: 'Tow Rig' }, madeBy: 'Rosa', sharedAt: 1 },
    ])
    await setHomebrewHidden(db, 'pat-1', true)
    expect(await (await serveHomebrew(at(), env(db))).json()).toEqual([])
  })

  it('answers 503, uncached, when the database fails mid-read', async () => {
    const db = await seeded()
    db.sqlite.exec('drop table homebrew_patterns')
    const res = await serveHomebrew(at(), env(db))
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
