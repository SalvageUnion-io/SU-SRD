import { BOUNDARY_KINDS } from 'game-domain/games/safety'
import { z } from 'salvageunion-reference/zod'
import type { ClientMessage, ServerMessage } from '../protocol'
import type { GameActAnswer, GameActName } from './acts'

/**
 * The acts a room's socket may send (`../protocol.ts`), each with the shape
 * its args must have. What the args mean (a known condition, a Tech Level in
 * range, a name not too long) is still the act's to refuse; every other act
 * is the Worker's to call.
 */
const NONE = z.unknown()
const BY_ID = z.object({ id: z.string() })
const ENTRY = z.looseObject({ id: z.string() })

const SALVAGE_AREA_SET = z.object({
  area: z.object({ name: z.string(), techLevel: z.number(), supply: z.number() }).nullable(),
})
const SALVAGE_AREA_SPEND = z.object({ pilotId: z.string() })

/** A Game room's: its table's 4.3 state. */
export const GAME_SOCKET_ACTS = {
  'scenes.setConditions': z.object({ conditions: z.array(z.string()) }),
  'scenes.passHour': NONE,
  'salvageAreas.set': SALVAGE_AREA_SET,
  'salvageAreas.spend': SALVAGE_AREA_SPEND,
  'ledger.setFaction': z.object({ faction: ENTRY }),
  'ledger.removeFaction': BY_ID,
  'ledger.setJob': z.object({ job: ENTRY }),
  'ledger.setJobState': z.object({ id: z.string(), state: z.enum(['open', 'dropped']) }),
  'ledger.removeJob': BY_ID,
  'ledger.completeJob': BY_ID,
  'ledger.collectIncome': NONE,
  'safety.addBoundary': z.object({ kind: z.enum(BOUNDARY_KINDS), text: z.string() }),
  'safety.removeBoundary': z.object({ boundaryId: z.string() }),
  'safety.showStop': NONE,
  'safety.liftStop': NONE,
  'safety.setPostToChannel': z.object({ on: z.boolean() }),
} satisfies Partial<Record<GameActName, z.ZodType>>

/** An account room's: its player's solo table's salvage area. */
export const ACCOUNT_SOCKET_ACTS = {
  'salvageAreas.set': SALVAGE_AREA_SET,
  'salvageAreas.spend': SALVAGE_AREA_SPEND,
}

type ActMessage = Extract<ClientMessage, { type: 'act' }>
type SocketActs = Record<string, z.ZodType>
type Asked<A extends SocketActs> = {
  [N in keyof A & string]: { name: N; args: z.infer<A[N]> }
}[keyof A & string]

/** The act a socket asked for of `acts`, its args checked, or why the room will not run it. */
export function socketAct<A extends SocketActs>(
  message: ActMessage,
  acts: A
): Asked<A> | { refusal: string } {
  if (!Object.hasOwn(acts, message.name)) return { refusal: 'Not an act this room takes' }
  const args = acts[message.name]?.safeParse(message.args)
  if (args === undefined || !args.success) return { refusal: 'Not what that act takes' }
  return { name: message.name, args: args.data } as Asked<A>
}

/** What the sender of an act hears: its value, or why it was refused. */
export function actAnswer(id: string, answer: GameActAnswer<unknown>): ServerMessage {
  return answer.ok
    ? { type: 'answered', id, value: answer.value }
    : { type: 'refused', id, reason: answer.refusal }
}
