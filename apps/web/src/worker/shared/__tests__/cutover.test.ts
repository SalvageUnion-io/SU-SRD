import { describe, expect, it } from 'bun:test'
import { projectAccount, projectGame, projectSite } from '../cutover'
import { gameOfInvite, gamesOf } from '../games'
import { ACCOUNT, GAME, SITE } from './cutoverBundles'
import { testDb } from './d1'

/** The cutover's D1 rows, as each bundle writes them, and written again. */

const all = (db: ReturnType<typeof testDb>, sql: string) => db.sqlite.query(sql).all()

describe('projectAccount', () => {
  it('writes its totals and its solo channel, and again changes nothing', async () => {
    const db = testDb()
    await projectAccount(db, ACCOUNT, 10)
    await projectAccount(db, ACCOUNT, 11)
    expect(
      all(db, 'select discord_id, pilots, mechs, crawlers, npcs, patterns from account_totals')
    ).toEqual([{ discord_id: 'd1', pilots: 2, mechs: 1, crawlers: 0, npcs: 0, patterns: 1 }])
    expect(
      all(db, 'select channel_id, game_id, bound_by, channel_name, bound_at from channel_bindings')
    ).toEqual([
      { channel_id: 'C1', game_id: null, bound_by: 'd1', channel_name: 'solo', bound_at: 3 },
    ])
  })
})

describe('projectGame', () => {
  it('writes the Game, its members, its invite and its channel; a binding with no binder is left out', async () => {
    const db = testDb()
    await projectGame(db, GAME, 'Jrvs', 10)
    await projectGame(db, GAME, 'Jrvs', 11)
    expect(await gamesOf(db, 'd2')).toEqual([
      { gameId: 'g1', name: 'Reclamation', mediator: false, organizer: false },
    ])
    expect(all(db, 'select mediated_by from games')).toEqual([{ mediated_by: 'Jrvs' }])
    expect(await gameOfInvite(db, 'CODE')).toBe('g1')
    expect(all(db, 'select channel_id, game_id from channel_bindings')).toEqual([
      { channel_id: 'C2', game_id: 'g1' },
    ])
  })

  it('a Game with no live invite has none', async () => {
    const db = testDb()
    await projectGame(db, GAME, null, 10)
    await projectGame(db, { ...GAME, inviteCode: null }, null, 11)
    expect(await gameOfInvite(db, 'CODE')).toBeNull()
  })
})

describe('projectSite', () => {
  it('writes the site once: reports, takedowns, signals, and only the notes still waiting', async () => {
    const db = testDb()
    expect(await projectSite(db, SITE, 10)).toBe(true)
    expect(await projectSite(db, SITE, 11)).toBe(false)
    expect(all(db, 'select app_id, reporter_id, reason from homebrew_reports')).toEqual([
      { app_id: 'mp1', reporter_id: 'd2', reason: 'rude' },
    ])
    expect(all(db, 'select app_id, hidden, hidden_at from homebrew_moderation')).toEqual([
      { app_id: 'mp1', hidden: 1, hidden_at: 6 },
    ])
    expect(all(db, 'select key, count from usage_counts')).toEqual([{ key: 'bot:roll', count: 3 }])
    expect(all(db, 'select guild_id from bot_guilds')).toEqual([{ guild_id: 'G' }])
    expect(all(db, 'select taken_at, counts from metrics_snapshots')).toEqual([
      { taken_at: 8, counts: '{"pilots":2}' },
    ])
    expect(all(db, 'select sender, text, page, created_at, attempts from feedback')).toEqual([
      { sender: 'discord:d1', text: 'waiting', page: '/build', created_at: 9, attempts: 1 },
    ])
  })
})
