import { beforeEach, describe, expect, test } from 'bun:test'
import { RoomRefusal } from '../../../rooms/refusal'
import type { AccountDeletionDeps } from '../accountDeletion'
import { deleteRoomAccount } from '../accountDeletion'
import { testDb } from './d1'

/**
 * Account deletion over the shared database in memory and room stand-ins:
 * every Game forgets the player, their room is wiped, their rows go and
 * everyone else's stay.
 */

const WHO = { accountId: 'u-1', discordId: 'd-1' }
let db: ReturnType<typeof testDb>
let calls: string[]

function seed() {
  db.sqlite.exec(`
    insert into games (game_id, name, mediated_by, updated_at) values ('g-shared', 'Tenacity', null, 1), ('g-alone', 'Solo run', null, 1);
    insert into memberships (game_id, discord_id, mediator, organizer) values
      ('g-shared', 'd-1', 0, 1), ('g-shared', 'd-2', 0, 0), ('g-alone', 'd-1', 1, 1);
    insert into channel_bindings (channel_id, game_id, bound_by, channel_name, bound_at) values
      ('c-solo', null, 'd-1', 'mine', 1), ('c-shared', 'g-shared', 'd-1', 'crew', 1),
      ('c-alone', 'g-alone', 'd-1', 'empty', 1), ('c-other', null, 'd-2', 'theirs', 1);
    insert into homebrew_patterns (app_id, owner_id, chassis_ref, name, body, made_by, shared_at) values
      ('pat-1', 'd-1', null, 'Mine', '{}', 'Rosa', 1), ('pat-2', 'd-2', null, 'Theirs', '{}', 'Ana', 1);
    insert into homebrew_reports (app_id, reporter_id, reason, at) values
      ('pat-1', 'd-9', 'rude', 1), ('pat-2', 'd-1', 'rude', 1), ('pat-2', 'd-9', 'rude', 1);
    insert into homebrew_moderation (app_id, hidden, hidden_at) values ('pat-1', 1, 1), ('pat-2', 1, 1);
    insert into crew_patterns (app_id, owner_id, game_id, body, made_by, shared_at) values
      ('pat-1', 'd-1', 'g-shared', '{}', 'Rosa', 1), ('pat-2', 'd-2', 'g-shared', '{}', 'Ana', 1);
    insert into public_sheets (kind, app_id, owner_id, page, preview, created_at, updated_at, room) values
      ('pilot', 'p-1', 'd-1', '{}', '{}', 1, 1, 'game:g-shared'),
      ('pattern', 'pat-1', null, '{}', '{}', 1, 1, 'account:d-1'),
      ('pilot', 'p-2', 'd-2', '{}', '{}', 1, 1, 'game:g-shared');
    insert into account_totals (discord_id, updated_at) values ('d-1', 1), ('d-2', 1);
    insert into feedback (sender, source, kind, created_at) values
      ('discord:d-1', 'site', 'bug', 1), ('user:u-1', 'site', 'bug', 1), ('discord:d-2', 'site', 'bug', 1);
  `)
}

function deps(overrides: Partial<AccountDeletionDeps> = {}): AccountDeletionDeps {
  return {
    db,
    game: (gameId) => ({
      forget: async (userId) => {
        calls.push(`forget ${gameId} ${userId}`)
      },
      // The last member out: the Game's publish drops its row.
      republish: async () => {
        calls.push(`republish ${gameId}`)
        if (gameId === 'g-alone') db.sqlite.run("delete from games where game_id = 'g-alone'")
        return { sheets: 0, homebrew: 0 }
      },
    }),
    account: (discordId) => ({
      forget: async (actor) => {
        calls.push(`wipe ${discordId} as ${actor}`)
      },
    }),
    ...overrides,
  }
}

const left = (sql: string) => db.sqlite.query(sql).all()

beforeEach(() => {
  db = testDb()
  calls = []
  seed()
})

describe('deleteRoomAccount', () => {
  test('every Game forgets them, their room is wiped, and only their rows go', async () => {
    expect(await deleteRoomAccount(WHO, deps())).toBeNull()
    expect(calls.toSorted()).toEqual([
      'forget g-alone d-1',
      'forget g-shared d-1',
      'republish g-alone',
      'republish g-shared',
      'wipe d-1 as d-1',
    ])
    // A Game's channel stays with the Game, unless the Game ended.
    expect(left('select channel_id from channel_bindings order by channel_id')).toEqual([
      { channel_id: 'c-other' },
      { channel_id: 'c-shared' },
    ])
    expect(left('select app_id from homebrew_patterns')).toEqual([{ app_id: 'pat-2' }])
    expect(left('select app_id, reporter_id from homebrew_reports')).toEqual([
      { app_id: 'pat-2', reporter_id: 'd-9' },
    ])
    expect(left('select app_id from homebrew_moderation')).toEqual([{ app_id: 'pat-2' }])
    expect(left('select app_id from crew_patterns')).toEqual([{ app_id: 'pat-2' }])
    expect(left('select app_id from public_sheets')).toEqual([{ app_id: 'p-2' }])
    expect(left('select game_id, discord_id from memberships')).toEqual([
      { game_id: 'g-shared', discord_id: 'd-2' },
    ])
    expect(left('select discord_id from account_totals')).toEqual([{ discord_id: 'd-2' }])
    expect(left('select sender from feedback')).toEqual([{ sender: 'discord:d-2' }])
  })

  test('a second run finds nothing left and still answers null', async () => {
    await deleteRoomAccount(WHO, deps())
    calls = []
    expect(await deleteRoomAccount(WHO, deps())).toBeNull()
    expect(calls).toEqual(['wipe d-1 as d-1'])
  })

  test("a room's refusal answers 409 with its words; anything else, without them", async () => {
    const refusing = (error: Error) =>
      deps({
        account: () => ({
          forget: async () => {
            throw error
          },
        }),
      })
    const refused = await deleteRoomAccount(WHO, refusing(new RoomRefusal('Not yours')))
    expect(refused?.status).toBe(409)
    expect(await refused?.json()).toEqual({ errorMessage: 'Not yours' })
    const broken = await deleteRoomAccount(WHO, refusing(new Error('storage on fire')))
    expect(await broken?.json()).toEqual({ errorMessage: 'unreachable' })
    // Nothing of theirs left the shared database before the room did.
    expect(left("select count(*) as n from homebrew_patterns where owner_id = 'd-1'")).toEqual([
      { n: 1 },
    ])
  })
})
