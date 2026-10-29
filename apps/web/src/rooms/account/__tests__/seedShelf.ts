import type { EntityKind } from 'game-domain/entityKinds'
import type { LinkShape } from 'game-domain/links/linkRules'
import type { SeatRead } from '../../seats'
import type { AccountRoomLogic } from '../accountRoomLogic'
import type { ShelfRecord } from '../shelf'

/** What a test's Shelf holds before it starts: its player's units, links, solo seats and records. */
export type ShelfSeed = {
  owner: string
  /** The player's own name (`AccountShelf.profile`). */
  name?: string
  units?: { kind: EntityKind; id: string; body: Record<string, unknown>; publicRead?: boolean }[]
  links?: LinkShape[]
  seats?: (Pick<SeatRead, 'pilotId' | 'mount' | 'range'> & Partial<SeatRead>)[]
  records?: {
    table: ShelfRecord
    id: string
    body: Record<string, unknown>
    extra?: Record<string, unknown>
  }[]
}

/** Write `seed` straight into the room's store, as its player's play would have left it. */
export function seedShelf(room: AccountRoomLogic, seed: ShelfSeed, at: number): void {
  const { store } = room.shelf
  room.shelf.claim(seed.owner, at)
  if (seed.name !== undefined) {
    store.rows('update account set display_name = ? where id = 1', seed.name)
  }
  for (const unit of seed.units ?? []) {
    store.putUnit({
      id: unit.id,
      kind: unit.kind,
      ownerId: seed.owner,
      body: unit.body,
      headSeq: 0,
      fieldSeqs: {},
      publicRead: unit.publicRead ?? false,
      createdAt: at,
      updatedAt: at,
      leaseId: null,
    })
  }
  for (const link of seed.links ?? []) store.putLink(link, at)
  for (const seat of seed.seats ?? []) {
    room.solo.putSeat({
      activeEffects: [],
      resolving: null,
      ejected: false,
      ...seat,
      updatedAt: seat.updatedAt ?? at,
    })
  }
  for (const record of seed.records ?? []) {
    store.rows(
      `insert into records (tbl, app_id, body, extra, updated_at) values (?, ?, ?, ?, ?)`,
      record.table,
      record.id,
      JSON.stringify({ ...record.body, id: record.id }),
      JSON.stringify(record.extra ?? {}),
      at
    )
  }
}
