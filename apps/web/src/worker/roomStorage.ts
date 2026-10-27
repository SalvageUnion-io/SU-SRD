import type { DurableObject } from 'cloudflare:workers'
import type { RoomSql } from '../rooms/sql'

/** workerd's `DurableObjectState`, however the program types `cloudflare:workers`. */
type RoomState = ConstructorParameters<typeof DurableObject>[0]

/** A room's SQLite storage as the room logic reads it (`RoomSql`). */
export function storageSql(storage: RoomState['storage']): RoomSql {
  return {
    exec: (query, ...bindings) => storage.sql.exec(query, ...bindings).toArray() as never,
    transaction: (fn) => storage.transactionSync(fn),
  }
}
