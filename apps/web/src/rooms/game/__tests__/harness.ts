import {
  crawlerFixture,
  mechFixture,
  npcFixture,
  pilotFixture,
} from '../../../components/__tests__/fixtures'
import { bunSql } from '../../__tests__/bunSql'
import { migrate } from '../../migrate'
import type { ApplyOp, OpInput } from '../../ops'
import { GAME_ROOM } from '../../schemas'
import { GameRoomLogic } from '../gameRoomLogic'

/**
 * A Game room under `bun:sqlite`, and the people and sheets its suites use.
 *
 * `applyOp` here is ADR-063's merge at its simplest (`game-domain/ops/applyOp` is the real
 * one): patch over body, refused when a patched field moved after `baseSeq`,
 * and invalid for a patch that sets `invalid`. The room's job is what it does
 * with the answer, which is what these suites test.
 */
export const stubApplyOp: ApplyOp = (unit, op) => {
  if ('invalid' in op.patch) return { ok: false, reason: 'invalid', message: 'not a sheet field' }
  const fields = [...Object.keys(op.patch), ...(op.unset ?? [])]
  const base = op.baseSeq ?? unit.headSeq
  const conflicts = fields.filter((f) => (unit.fieldSeqs[f] ?? 0) > base)
  if (conflicts.length > 0) return { ok: false, reason: 'conflict', fields: conflicts }
  const seq = unit.headSeq + 1
  const body = { ...unit.body, ...op.patch }
  for (const f of op.unset ?? []) delete body[f]
  const before = Object.fromEntries(fields.map((f) => [f, unit.body[f] ?? null]))
  const fieldSeqs = { ...unit.fieldSeqs, ...Object.fromEntries(fields.map((f) => [f, seq])) }
  return { ok: true, unit: { ...unit, body, headSeq: seq, fieldSeqs }, seq, before }
}

export const ORGANIZER = 'd-org'
export const PLAYER = 'd-player'
export const MEDIATOR = 'd-med'
export const STRANGER = 'd-stranger'

export const AT = 1_800_000_000_000

let ids = 0

/** A fresh room holding nothing. */
export function emptyRoom(gameId = 'g1') {
  const sql = bunSql()
  migrate(sql, GAME_ROOM)
  let codes = 0
  const room = new GameRoomLogic(sql, {
    applyOp: stubApplyOp,
    newId: () => `id-${++ids}`,
    mintCode: () => `CODE${gameId.toUpperCase()}${++codes}`,
  })
  return { room, sql, gameId }
}

/** A Game made by `ORGANIZER`, joined by `PLAYER` and `MEDIATOR`, who mediates. */
export function table(gameId = 'g1', { mediator = true } = {}) {
  const made = emptyRoom(gameId)
  const { room } = made
  room.roster.create(ORGANIZER, { gameId, name: 'Tenacity', profile: profile('Org'), at: AT })
  const code = room.roster.inviteCode(ORGANIZER, AT)
  room.roster.redeem(PLAYER, code, profile('Player'), AT + 1)
  if (mediator) {
    room.roster.redeem(MEDIATOR, code, profile('Med'), AT + 2)
    room.roster.setMediator(ORGANIZER, MEDIATOR, true)
  }
  return { ...made, code }
}

export function profile(name: string) {
  return { displayName: name, avatarUrl: null }
}

export const bodies = {
  pilot: (id: string) =>
    pilotFixture({ id, name: `Pilot ${id}`, callsign: id, classRef: 'salvager' }),
  mech: (id: string) => mechFixture({ id, name: `Mech ${id}`, chassisRef: 'iron-mongrel' }),
  crawler: (id: string) => crawlerFixture({ id, name: `Crawler ${id}`, techLevel: '1' }),
  npc: (id: string) => npcFixture({ id }),
}

/** An op on `unitId` from the copy at `baseSeq`. */
export function op(unitId: string, patch: Record<string, unknown>, over: Partial<OpInput> = {}) {
  return {
    id: `op-${++ids}`,
    unitId,
    baseSeq: 0,
    at: AT,
    kind: 'manual',
    source: 'live-sheet',
    patch,
    ...over,
  } satisfies OpInput
}
