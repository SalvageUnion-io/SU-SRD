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
export const roomOps: { gameId: string | null; ops: readonly OpInput[] }[] = []

const ANSWER_NOTHING = async () => undefined

/**
 * What a stand-in room answers each batch and act with (throw to refuse it or
 * drop it), and whether there is one at all: closed, no room is open to write
 * through.
 */
export const roomAnswer: {
  submit: (ops: readonly OpInput[]) => Promise<void>
  act: (name: string, args: unknown) => Promise<unknown>
  open: boolean
} = { submit: ANSWER_NOTHING, act: ANSWER_NOTHING, open: true }

/** Every room takes every op and act, answering nothing; forget what they took. */
export function acceptingRooms(): void {
  roomActs.length = 0
  roomOps.length = 0
  roomAnswer.submit = ANSWER_NOTHING
  roomAnswer.act = ANSWER_NOTHING
  roomAnswer.open = true
}

standInRooms((gameId) =>
  roomAnswer.open
    ? {
        submit: async (ops: readonly OpInput[]) => {
          await roomAnswer.submit(ops)
          roomOps.push({ gameId, ops })
        },
        act: async (name: string, args: unknown) => {
          const answer = await roomAnswer.act(name, args)
          roomActs.push({ gameId, name, args })
          return answer
        },
      }
    : null
)
