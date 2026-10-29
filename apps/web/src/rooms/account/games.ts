import type { RoomSql } from '../sql'

/**
 * The Games the player is in, as their own room keeps them: the Worker
 * notes a Game before a create or a join reaches it, and a Game that ends
 * drops itself from each member's list. Account deletion reads this beside
 * the shared database's `memberships`, which a Game writes only when its
 * publish lands. A room older than the list seeds it once from those rows.
 */
export class AccountGames {
  constructor(private readonly sql: RoomSql) {}

  /** The player is in (or about to be in) `gameId`; noting it again keeps the first time. */
  joined(gameId: string, at: number): void {
    this.sql.exec('insert or ignore into games (game_id, joined_at) values (?, ?)', gameId, at)
  }

  /** The player is no longer in `gameId`. */
  left(gameId: string): void {
    this.sql.exec('delete from games where game_id = ?', gameId)
  }

  /** Every Game noted, oldest first. */
  list(): string[] {
    return this.sql
      .exec<{ game_id: string }>('select game_id from games order by joined_at, game_id')
      .map((row) => row.game_id)
  }

  /** Whether the room is claimed and has not yet seeded its list from the shared database. */
  needsSeed(): boolean {
    const row = this.sql.exec<{ games_seeded: number }>(
      'select games_seeded from account where id = 1'
    )[0]
    return row?.games_seeded === 0
  }

  /** Note each of `gameIds` (the shared database's memberships) and never seed again. */
  seed(gameIds: readonly string[], at: number): void {
    this.sql.transaction(() => {
      for (const gameId of gameIds) this.joined(gameId, at)
      this.sql.exec('update account set games_seeded = 1 where id = 1')
    })
  }
}
