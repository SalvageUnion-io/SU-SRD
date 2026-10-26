import { describe, expect, it } from 'bun:test'
import type { AccountBundle, GameBundle } from 'game-domain/migration/bundle'
import type { CutoverRooms } from '../cutover'
import { handleCutover } from '../cutover'
import { ACCOUNT, GAME, SITE } from '../shared/__tests__/cutoverBundles'
import { testDb } from '../shared/__tests__/d1'
import { isFilled } from '../shared/db'

/** The cutover's door: who gets in, and what each step imports and writes. */

const SECRET = 'cutover-secret'

/** Rooms that take each bundle once and report one difference for Game g1. */
function fakeRooms() {
  const took = new Set<string>()
  const seen: string[] = []
  const rooms: CutoverRooms = {
    async importAccount(b: AccountBundle) {
      seen.push(`account ${b.discordId}`)
      const imported = !took.has(b.discordId)
      took.add(b.discordId)
      return { imported, diff: [] }
    },
    async importGame(b: GameBundle) {
      seen.push(`game ${b.gameId}`)
      return { imported: true, diff: ['links: 1 ≠ 0'] }
    },
  }
  return { rooms, seen }
}

function post(step: string, body: unknown, secret: string | null = SECRET, method = 'POST') {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret !== null) headers.authorization = `Bearer ${secret}`
  return new Request(`https://su.test/admin/cutover/${step}`, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })
}

describe('the cutover door', () => {
  it('is not there without CUTOVER_SECRET, and refuses the wrong secret or a GET', async () => {
    const db = testDb()
    const { rooms, seen } = fakeRooms()
    expect((await handleCutover(post('finish', {}), { SHARED: db }, rooms)).status).toBe(404)
    const env = { SHARED: db, CUTOVER_SECRET: SECRET }
    expect((await handleCutover(post('finish', {}, null), env, rooms)).status).toBe(401)
    expect((await handleCutover(post('finish', {}, 'cutover-secreT'), env, rooms)).status).toBe(401)
    expect((await handleCutover(post('finish', {}, 'short'), env, rooms)).status).toBe(401)
    expect((await handleCutover(post('finish', null, SECRET, 'GET'), env, rooms)).status).toBe(405)
    expect(seen).toEqual([])
    expect(await isFilled(db)).toBe(false)
  })

  it('imports an account into its room and writes its rows; a second post is taken once', async () => {
    const db = testDb()
    const { rooms } = fakeRooms()
    const env = { SHARED: db, CUTOVER_SECRET: SECRET }
    const first = await handleCutover(post('account', ACCOUNT), env, rooms, 10)
    expect(await first.json()).toEqual({ imported: true, diff: [] })
    const again = await handleCutover(post('account', ACCOUNT), env, rooms, 11)
    expect(await again.json()).toEqual({ imported: false, diff: [] })
    expect(db.sqlite.query('select discord_id from account_totals').all()).toEqual([
      { discord_id: 'd1' },
    ])
  })

  it('imports a Game with its Mediator’s name, and answers the room’s differences', async () => {
    const db = testDb()
    const { rooms } = fakeRooms()
    const env = { SHARED: db, CUTOVER_SECRET: SECRET }
    const res = await handleCutover(post('game', { bundle: GAME, mediatedBy: 'Jrvs' }), env, rooms)
    expect(await res.json()).toEqual({ imported: true, diff: ['links: 1 ≠ 0'] })
    expect(db.sqlite.query('select name, mediated_by from games').all()).toEqual([
      { name: 'Reclamation', mediated_by: 'Jrvs' },
    ])
  })

  it('writes the site once, then finish marks the shared database filled', async () => {
    const db = testDb()
    const { rooms } = fakeRooms()
    const env = { SHARED: db, CUTOVER_SECRET: SECRET }
    expect(await (await handleCutover(post('site', SITE), env, rooms)).json()).toEqual({
      written: true,
    })
    expect(await (await handleCutover(post('site', SITE), env, rooms)).json()).toEqual({
      written: false,
    })
    expect(await (await handleCutover(post('finish', {}), env, rooms)).json()).toEqual({
      filled: true,
    })
    expect(await isFilled(db)).toBe(true)
  })

  it('refuses a bundle that is not one, and a step that is not there', async () => {
    const db = testDb()
    const { rooms, seen } = fakeRooms()
    const env = { SHARED: db, CUTOVER_SECRET: SECRET }
    const bad = async (step: string, body: unknown) =>
      (await handleCutover(post(step, body), env, rooms)).status
    expect(await bad('account', { discordId: 'd1' })).toBe(400)
    expect(await bad('game', { bundle: GAME, mediatedBy: 3 })).toBe(400)
    expect(await bad('game', { mediatedBy: null })).toBe(400)
    expect(await bad('site', [])).toBe(400)
    expect(await bad('sweep', {})).toBe(404)
    expect(seen).toEqual([])
  })
})
