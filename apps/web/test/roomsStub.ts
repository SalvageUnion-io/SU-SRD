/**
 * The rooms every app unit test gets: each room it has not opened takes every
 * write (`standInRooms`), so a signed-in store write settles and the stores
 * run for real.
 *
 * A file that needs to see the writes reads `roomOps` and `roomActs`; one that
 * needs a room to refuse or fail sets `roomAnswer.submit` or `.act`, and puts
 * them back after (`acceptingRooms`).
 */

import type { OpInput } from 'game-domain/ops/applyOp'
import { standInRooms } from '../src/replica/roomSocket'

/** Every act a stand-in room took, in order, with the Game it was sent to. */
export const roomActs: { gameId: string | null; name: string; args: unknown }[] = []

/** Every batch of ops a stand-in room took, in order, with the Game it was sent to. */
export const roomOps: { gameId: string | null; ops: readonly OpInput[]; replayed: boolean }[] = []

const ANSWER_NOTHING = async () => undefined

/** Every op id a stand-in room applied: one sent again is acked, and not applied again. */
const landed = new Set<string>()

/**
 * What a stand-in room answers each batch and act with (throw to refuse it or
 * drop it), and whether there is one at all: closed (for every Game, or for
 * the Games `open` answers false), no room is open to write through.
 */
export const roomAnswer: {
  /** The op ids it applied, or nothing for every one not applied before. */
  submit: (ops: readonly OpInput[]) => Promise<readonly string[] | undefined>
  act: (name: string, args: unknown) => Promise<unknown>
  open: boolean | ((gameId: string | null) => boolean)
} = { submit: ANSWER_NOTHING, act: ANSWER_NOTHING, open: true }

/** Every room takes every op and act, answering nothing; forget what they took. */
export function acceptingRooms(): void {
  roomActs.length = 0
  roomOps.length = 0
  landed.clear()
  roomAnswer.submit = ANSWER_NOTHING
  roomAnswer.act = ANSWER_NOTHING
  roomAnswer.open = true
}

standInRooms((gameId) =>
  (typeof roomAnswer.open === 'function' ? roomAnswer.open(gameId) : roomAnswer.open)
    ? {
        submit: async (ops: readonly OpInput[], options?: { replayed?: boolean }) => {
          const fresh = await roomAnswer.submit(ops)
          roomOps.push({ gameId, ops, replayed: options?.replayed === true })
          const applied = fresh ?? ops.map((op) => op.id).filter((id) => !landed.has(id))
          for (const id of applied) landed.add(id)
          return applied
        },
        act: async (name: string, args: unknown) => {
          const answer = await roomAnswer.act(name, args)
          roomActs.push({ gameId, name, args })
          return answer
        },
      }
    : null
)
