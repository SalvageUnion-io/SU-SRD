/**
 * The rooms every app unit test gets: each room it has not opened takes every
 * write (`standInRooms`), as `convexClientStub.ts` lands every Convex commit,
 * so a signed-in store write settles and the stores run for real.
 *
 * A file that needs to see the acts reads `roomActs`; one that needs a room to
 * refuse or fail sets `roomAnswer.act`, and puts both back after
 * (`acceptingRooms`).
 */

import { standInRooms } from '../src/replica/roomSocket'

/** Every act a stand-in room took, in order, with the Game it was sent to. */
export const roomActs: { gameId: string | null; name: string; args: unknown }[] = []

const ANSWER_NOTHING = async () => undefined

/**
 * What a stand-in room answers each act with (throw to refuse it or drop it),
 * and whether there is one at all: closed, no room is open to write through.
 */
export const roomAnswer: { act: (name: string, args: unknown) => Promise<unknown>; open: boolean } =
  { act: ANSWER_NOTHING, open: true }

/** Every room takes every op and act, answering nothing; forget what they took. */
export function acceptingRooms(): void {
  roomActs.length = 0
  roomAnswer.act = ANSWER_NOTHING
  roomAnswer.open = true
}

standInRooms((gameId) =>
  roomAnswer.open
    ? {
        submit: async () => undefined,
        act: async (name: string, args: unknown) => {
          const answer = await roomAnswer.act(name, args)
          roomActs.push({ gameId, name, args })
          return answer
        },
      }
    : null
)
