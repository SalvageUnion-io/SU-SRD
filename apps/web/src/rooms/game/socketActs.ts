import { ENTITY_KINDS } from 'game-domain/entityKinds'
import { BOUNDARY_KINDS } from 'game-domain/games/safety'
import { EntityRefSchema } from 'game-domain/schemas/entity'
import { CrewSlotSchema, SoftLinkSchema } from 'game-domain/schemas/softLink'
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
const SET_PUBLIC = z.object({
  kind: z.enum(['pilot', 'mech', 'crawler', 'npc']),
  appId: z.string(),
  isPublic: z.boolean(),
})

/** A unit made, or deleted, in the room it lives in; its body is the kind's schema's to check. */
const CREATE_UNIT = z.object({ id: z.string(), kind: z.enum(ENTITY_KINDS), body: z.unknown() })
const REMOVE_UNIT = z.object({ unitId: z.string() })
/** A link by its type, its ends and its slot (`LinkShape`). */
const LINK = z.object({
  link: z.object({
    type: SoftLinkSchema.shape.type,
    from: EntityRefSchema,
    to: EntityRefSchema,
    slot: CrewSlotSchema.optional(),
  }),
})

/** What either room takes for its units: making one, deleting one, and wiring them. */
const UNIT_ACTS = {
  createUnit: CREATE_UNIT,
  removeUnit: REMOVE_UNIT,
  drawLink: LINK,
  removeLink: LINK,
}

/** A tray NPC's fight patch (`opposition.ts`'s `TrayPatch`); what each field may hold is the act's to refuse. */
const TRAY_PATCH = z.object({
  currentHp: z.number().optional(),
  conditions: z.array(z.string()).optional(),
  name: z.string().optional(),
  lastMediatorRoll: z.unknown().optional(),
  salvaged: z.literal(true).optional(),
  important: z.boolean().optional(),
  maxEp: z.number().optional(),
  heatCap: z.number().optional(),
  currentEp: z.number().optional(),
  currentHeat: z.number().optional(),
  lastImportantRoll: z.unknown().optional(),
})

const SEAT = z.object({ pilotId: z.string() })
/** A seat at either table: the Game's, or (an account room's) the solo pilot's. */
const SEAT_ACTS = {
  'seats.board': SEAT.extend({ mechId: z.string() }),
  'seats.dismount': SEAT,
  'seats.eject': SEAT,
  'seats.setRange': SEAT.extend({ range: z.string() }),
  'seats.toggleEffect': SEAT.extend({ ref: z.string() }),
  'seats.setResolving': SEAT.extend({ resolving: z.unknown() }),
  'seats.clearResolving': SEAT,
}

/** A Downtime's moves; solo, `pilotId` names the pilot whose it is. */
const PLACE = z.object({ pilotId: z.string().optional() })
const DOWNTIME_ACTS = {
  'downtime.begin': PLACE,
  'downtime.advance': PLACE,
  'downtime.setStep': PLACE.extend({ stepIndex: z.number() }),
  'downtime.end': PLACE,
  'downtime.spendUpkeep': PLACE,
  'downtime.spendNanites': PLACE,
}

/** A unit's Change Log, as the drawer reads it. */
const FOR_ENTITY = z.object({ entityId: z.string() })

/** A Game room's: its units, its table's 4.3 state, the Mediator's tray and running encounter, its seats, Downtime, proposals and feed. */
export const GAME_SOCKET_ACTS = {
  ...UNIT_ACTS,
  'mediator.addNpc': z.object({ body: z.unknown() }),
  'mediator.removeNpc': z.object({ npcId: z.string() }),
  'mediator.updateNpc': z.object({ npcId: z.string(), patch: TRAY_PATCH }),
  'mediator.recordGroupRoll': z.object({ groupId: z.string(), roll: z.unknown() }),
  /** The Mediator's own encounter rides along: the room cannot read their shelf. */
  'mediator.runEncounter': z.object({
    encounter: z.unknown(),
    clear: z.boolean(),
    waves: z.boolean().optional(),
  }),
  'mediator.bringInWave': z.object({ wave: z.number().int() }),
  'mediator.endEncounter': NONE,
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

  ...SEAT_ACTS,
  ...DOWNTIME_ACTS,
  'downtime.markStepDone': z.object({ done: z.boolean() }),
  'ops.propose': z.object({
    entityId: z.string(),
    field: z.string(),
    after: z.unknown(),
    reason: z.string().optional(),
  }),
  'ops.accept': z.object({ opId: z.string() }),
  'ops.decline': z.object({ opId: z.string() }),
  'changeLog.appendChangeLog': z.object({
    entries: z.array(
      z.object({
        entityType: z.string(),
        field: z.string(),
        after: z.unknown().optional(),
        source: z.string(),
        ts: z.number(),
      })
    ),
  }),
  'changeLog.broadcast': z.object({ message: z.string() }),
  'changeLog.forEntity': FOR_ENTITY,
  'publicSheet.setPublic': SET_PUBLIC,
} satisfies Partial<Record<GameActName, z.ZodType>>

/** An account room's Shelf: the records its player keeps there, and who may read what. */
export const SHELF_ACTS = {
  'shelf.upsertMechPattern': z.object({ body: ENTRY }),
  'shelf.removeMechPattern': z.object({ patternId: z.string() }),
  'shelf.upsertEncounterNpc': z.object({ body: ENTRY }),
  'shelf.removeEncounterNpc': z.object({ npcId: z.string() }),
  'shelf.upsertEncounter': z.object({ body: ENTRY }),
  'shelf.removeEncounter': z.object({ encounterId: z.string() }),
  'shelf.setPatternVisibility': z.object({
    patternId: z.string(),
    visibility: z.enum(['private', 'link', 'game']),
    gameId: z.string().optional(),
  }),
  'homebrew.setShared': z.object({ patternId: z.string(), shared: z.boolean() }),
  'publicSheet.setPublic': SET_PUBLIC,
}

/** An account room's: its player's units and solo table, its seats, Downtime and salvage area, and its Shelf's records. */
export const ACCOUNT_SOCKET_ACTS = {
  ...UNIT_ACTS,
  ...SHELF_ACTS,
  'salvageAreas.set': SALVAGE_AREA_SET,
  'salvageAreas.spend': SALVAGE_AREA_SPEND,
  ...SEAT_ACTS,
  ...DOWNTIME_ACTS,
  'changeLog.forEntity': FOR_ENTITY,
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
