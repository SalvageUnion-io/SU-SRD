import { BOUNDARY_KINDS } from 'game-domain/games/safety'
import { z } from 'salvageunion-reference/zod'
import type { ClientMessage, ServerMessage } from '../protocol'
import type { GameActAnswer, GameActName } from './acts'

/**
 * The acts a member's socket may send (`../protocol.ts`), each with the
 * shape its args must have. What the args mean (a known condition, a Tech
 * Level in range, a name not too long) is still the act's to refuse; every
 * other act is the Worker's to call.
 */
const NONE = z.unknown()
const BY_ID = z.object({ id: z.string() })
const ENTRY = z.looseObject({ id: z.string() })

const SOCKET_ACTS = {
  'scenes.setConditions': z.object({ conditions: z.array(z.string()) }),
  'scenes.passHour': NONE,
  'salvageAreas.set': z.object({
    area: z.object({ name: z.string(), techLevel: z.number(), supply: z.number() }).nullable(),
  }),
  'salvageAreas.spend': z.object({ pilotId: z.string() }),
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

type ActMessage = Extract<ClientMessage, { type: 'act' }>

/** The act a socket asked for, its args checked, or why the room will not run it. */
export function socketAct(
  message: ActMessage
): { name: keyof typeof SOCKET_ACTS; args: never } | { refusal: string } {
  if (!Object.hasOwn(SOCKET_ACTS, message.name)) return { refusal: 'Not an act this room takes' }
  const name = message.name as keyof typeof SOCKET_ACTS
  const args = SOCKET_ACTS[name].safeParse(message.args)
  if (!args.success) return { refusal: 'Not what that act takes' }
  return { name, args: args.data as never }
}

/** What the sender of an act hears: its value, or why it was refused. */
export function actAnswer(id: string, answer: GameActAnswer<unknown>): ServerMessage {
  return answer.ok
    ? { type: 'answered', id, value: answer.value }
    : { type: 'refused', id, reason: answer.refusal }
}
