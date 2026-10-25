import { describe, expect, it } from 'bun:test'
import { putGame, putMembership } from '../games'
import {
  bumpUsage,
  dropAccountTotals,
  putAccountTotals,
  readMetrics,
  takeSnapshot,
  touchGuild,
  weekStartOf,
} from '../signals'
import { testDb } from './d1'

/** Usage metrics in the shared database (ADR-057): counts, never who. */

const DAY = 86_400_000
/** Monday 2026-10-19 00:00 UTC. */
const MONDAY = Date.UTC(2026, 9, 19)

describe('weekStartOf', () => {
  it('files every moment of a week under its Monday', () => {
    expect(weekStartOf(MONDAY)).toBe(MONDAY)
    expect(weekStartOf(MONDAY + 6 * DAY + DAY - 1)).toBe(MONDAY)
    expect(weekStartOf(MONDAY + 7 * DAY)).toBe(MONDAY + 7 * DAY)
  })
})

describe('the weekly counters', () => {
  it('count per key per week, and read the last eight weeks newest first', async () => {
    const db = testDb()
    await bumpUsage(db, 'bot:su roll', MONDAY + 1)
    await bumpUsage(db, 'bot:su roll', MONDAY + 2)
    await bumpUsage(db, 'downtime:game', MONDAY + 3)
    await bumpUsage(db, 'bot:su roll', MONDAY + 7 * DAY)
    await bumpUsage(db, 'bot:su roll', MONDAY - 20 * 7 * DAY)
    const { weeks, snapshot } = await readMetrics(db)
    expect(snapshot).toBeNull()
    expect(weeks).toEqual([
      { weekStart: MONDAY + 7 * DAY, counts: { 'bot:su roll': 1 } },
      { weekStart: MONDAY, counts: { 'bot:su roll': 2, 'downtime:game': 1 } },
    ])
  })
})

describe('the daily snapshot', () => {
  it('sums the account rooms, the Games and the servers, and the newest is read', async () => {
    const db = testDb()
    const now = MONDAY + 3 * DAY
    await putAccountTotals(db, {
      discordId: 'u-1',
      pilots: 2,
      mechs: 1,
      crawlers: 1,
      npcs: 0,
      patterns: 3,
    })
    await putAccountTotals(db, {
      discordId: 'u-2',
      pilots: 1,
      mechs: 1,
      crawlers: 0,
      npcs: 4,
      patterns: 0,
    })
    await putAccountTotals(db, {
      discordId: 'u-3',
      pilots: 9,
      mechs: 9,
      crawlers: 9,
      npcs: 9,
      patterns: 9,
    })
    await dropAccountTotals(db, 'u-3')
    await putGame(db, { gameId: 'g-1', name: 'Together', mediatedBy: null })
    await putGame(db, { gameId: 'g-2', name: 'Alone', mediatedBy: null })
    await putMembership(db, { gameId: 'g-1', discordId: 'u-1', mediator: true, organizer: true })
    await putMembership(db, { gameId: 'g-1', discordId: 'u-2', mediator: false, organizer: false })
    await putMembership(db, { gameId: 'g-2', discordId: 'u-1', mediator: true, organizer: true })
    await touchGuild(db, 'guild-old', now - 30 * DAY)
    await touchGuild(db, 'guild-new', now - DAY)

    await takeSnapshot(db, now - DAY)
    const counts = await takeSnapshot(db, now)
    expect(counts).toEqual({
      accounts: 2,
      pilots: 3,
      mechs: 2,
      crawlers: 1,
      npcs: 4,
      patterns: 3,
      games: 2,
      sharedGames: 1,
      botGuilds: 2,
      botGuildsThisWeek: 1,
    })
    expect((await readMetrics(db)).snapshot).toEqual({ takenAt: now, counts })
  })

  it("moves a server's last answer on by the hour, not by the command", async () => {
    const db = testDb()
    await touchGuild(db, 'g', 1000)
    await touchGuild(db, 'g', 2000)
    expect(db.sqlite.query('select last_seen_at from bot_guilds').get()).toEqual({
      last_seen_at: 1000,
    })
    await touchGuild(db, 'g', 1000 + DAY)
    expect(db.sqlite.query('select first_seen_at, last_seen_at from bot_guilds').get()).toEqual({
      first_seen_at: 1000,
      last_seen_at: 1000 + DAY,
    })
  })
})
