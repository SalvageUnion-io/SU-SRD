/**
 * The rooms (ADR-064): a SQLite Durable Object per account and per Game,
 * exported from this Worker (`exports` in `wrangler.jsonc`) and reached by
 * name through `cloudflare:workers`' `exports`, so each Preview gets its own namespaces. The
 * logic lives in `../rooms/`, over `RoomSql`; this file is only the wiring.
 */

import { DurableObject, exports } from 'cloudflare:workers'
import type {
  DurableObjectNamespace,
  DurableObjectState,
  DurableObjectStorage,
} from '@cloudflare/workers-types'
import type { Migrations } from '../rooms/migrate'
import { migrate } from '../rooms/migrate'
import { ACCOUNT_ROOM, GAME_ROOM } from '../rooms/schemas'
import type { RoomSql } from '../rooms/sql'

type RoomHealth = { schema: number }

/** `GET /__rooms/health`: each room kind opens and migrates, or the answer is a 503. */
export const ROOMS_HEALTH_PATH = '/__rooms/health'

function storageSql(storage: DurableObjectStorage): RoomSql {
  return {
    exec: (query, ...bindings) => storage.sql.exec(query, ...bindings).toArray() as never,
    transaction: (fn) => storage.transactionSync(fn),
  }
}

abstract class Room extends DurableObject {
  protected readonly sql: RoomSql
  private schema = 0

  constructor(ctx: DurableObjectState, env: unknown, migrations: Migrations) {
    super(ctx, env)
    this.sql = storageSql(ctx.storage)
    // Before the first request is delivered: no request sees an old schema.
    void ctx.blockConcurrencyWhile(async () => {
      this.schema = migrate(this.sql, migrations)
    })
  }

  health(): RoomHealth {
    return { schema: this.schema }
  }
}

/** @public A player's shelf; loaded by workerd (`wrangler.jsonc` `exports`). */
export class AccountRoom extends Room {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env, ACCOUNT_ROOM)
  }
}

/** @public A Game; loaded by workerd (`wrangler.jsonc` `exports`). */
export class GameRoom extends Room {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env, GAME_ROOM)
  }
}

/** The room namespaces, as `wrangler.jsonc` declares them. */
function rooms() {
  return exports as unknown as {
    AccountRoom: DurableObjectNamespace<AccountRoom>
    GameRoom: DurableObjectNamespace<GameRoom>
  }
}

export async function serveRoomsHealth(): Promise<Response> {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' }
  try {
    const [account, game] = await Promise.all([
      rooms().AccountRoom.getByName('health').health(),
      rooms().GameRoom.getByName('health').health(),
    ])
    return new Response(JSON.stringify({ account, game }), { headers })
  } catch (error) {
    console.error('rooms health failed', error)
    return new Response(JSON.stringify({ error: 'rooms_unavailable' }), { status: 503, headers })
  }
}
