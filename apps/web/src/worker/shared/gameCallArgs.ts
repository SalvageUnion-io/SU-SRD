/**
 * What each Games call takes (`gameCalls.ts`'s `CALL_ARGS`), in its own module
 * so the calls keep their file's room.
 */
import { ENTITY_KINDS } from 'game-domain/entityKinds'
import { GamePlanSchema } from 'game-domain/schemas/gamePlan'
import { z } from 'salvageunion-reference/zod'
import type { GameCallName } from './gameCalls'

const GAME = z.object({ gameId: z.string() })
const KIND = z.enum(ENTITY_KINDS)

/**
 * What each call takes, parsed before it runs, as a socket act's args are
 * (`../../rooms/game/socketActs.ts`). What the args mean (a name not too
 * long, a unit that exists) is still the room's to refuse.
 */
export const CALL_ARGS = {
  'games.listMine': z.object({}),
  'games.liveSessions': z.object({}),
  'games.get': GAME,
  'games.names': GAME,
  'games.create': z.object({
    name: z.string(),
    templateOrigin: z.string().optional(),
    mediator: z.boolean().optional(),
  }),
  'games.destroy': GAME.extend({ dropTemplateUnits: z.boolean().optional() }),
  'games.setMediator': GAME.extend({ userId: z.string(), mediator: z.boolean() }),
  'games.update': GAME.extend({ name: z.string().optional(), description: z.string().optional() }),
  'games.removeMember': GAME.extend({ userId: z.string().optional() }),
  'games.takeOffRoster': GAME.extend({ pilotId: z.string() }),
  'games.putBack': GAME.extend({ unitIds: z.array(z.string()).min(1).max(8) }),
  'plan.get': GAME,
  'plan.mine': GAME,
  'plan.set': GAME.extend({ plan: GamePlanSchema }),
  'games.setPrimaryCrawler': GAME.extend({ crawlerId: z.string() }),
  'invites.link': GAME,
  'invites.reset': GAME,
  'invites.redeem': z.object({ code: z.string() }),
  'templates.list': z.object({}),
  'templates.createGame': z.object({
    templateId: z.string(),
    name: z.string().optional(),
    mediator: z.boolean().optional(),
  }),
  'ownership.assign': GAME.extend({ entityId: z.string(), userId: z.string().optional() }),
  'ownership.unassign': GAME.extend({ entityId: z.string() }),
  'entities.remove': GAME.extend({ entityId: z.string() }),
  'entities.removeCrawler': GAME.extend({ crawlerId: z.string() }),
  'entities.locate': z.object({ kind: KIND, id: z.string() }),
  'entities.move': z.object({ kind: KIND, appId: z.string(), gameId: z.string().nullable() }),
  'channelBindings.mine': z.object({}),
  'channelBindings.current': z.object({ gameId: z.string().optional() }),
  'channelBindings.launch': z.object({ channelId: z.string().min(1) }),
  'channelBindings.bindHere': z.object({
    channelId: z.string().min(1),
    gameId: z.string(),
    instanceId: z.string().min(1),
  }),
  'channelBindings.postRoll': z.object({
    gameId: z.string().optional(),
    pilotId: z.string().optional(),
    roll: z.object({
      tableName: z.string(),
      rolls: z.array(z.number()),
      label: z.string().optional(),
    }),
  }),
} satisfies Record<GameCallName, z.ZodType>
