import type { EntityKind } from 'game-domain/entityKinds'
import type { LinkShape } from 'game-domain/links/linkRules'
import {
  STARTER_CRAWLERS,
  STARTER_MECHS,
  STARTER_PILOTS,
  STARTER_SOFT_LINKS,
} from 'game-domain/starterSet/starterSet'
import { RoomRefusal } from '../refusal'
import type { GameRoomLogic } from './gameRoomLogic'
import type { Profile } from './roster'
import { parseUnitBody } from './units'

/**
 * Starting a Game from a template (ADR-030): a pre-built crew whose units
 * **arrive unassigned**, for the table runner to hand out as players join.
 * Each unit takes a fresh id, so two Games started from one template never share
 * a unit's id when they end and hand their units to the same Training Bay.
 */

/** The templates a Game can start from, as the new-Game control lists them. */
const GAME_TEMPLATES = {
  'starter-set': {
    name: "Reclamation of the Wastes — Union Crawler #430 'Tenacity'",
    description:
      'The six Pilots of the Salvage Union Starter Set, their Mechs, and their crawler. Everyone arrives unassigned for you to hand out.',
  },
} as const

type GameTemplateId = keyof typeof GAME_TEMPLATES

/** The templates as `templates.list` answered them. */
export function templateList() {
  return Object.entries(GAME_TEMPLATES).map(([id, t]) => ({
    id: id as GameTemplateId,
    name: t.name,
    description: t.description,
  }))
}

/**
 * Make this room a new Game seeded from `templateId`. Its creator is the
 * Organizer, as `roster.create` makes them; the template's crawler is primary
 * and its crew links put everybody aboard. Starting it again is a no-op.
 */
export function seedTemplate(
  room: GameRoomLogic,
  actor: string,
  args: {
    gameId: string
    templateId: string
    name?: string
    profile: Profile
    at: number
    newId?: () => string
  }
): void {
  if (!Object.hasOwn(GAME_TEMPLATES, args.templateId)) {
    throw new RoomRefusal('There is no such template')
  }
  const template = GAME_TEMPLATES[args.templateId as GameTemplateId]
  const newId = args.newId ?? (() => crypto.randomUUID())
  const { store } = room
  store.sql.transaction(() => {
    if (store.game() !== null) return
    room.roster.create(actor, {
      gameId: args.gameId,
      name: args.name?.trim() || template.name,
      templateOrigin: args.templateId,
      profile: args.profile,
      at: args.at,
    })
    const ids = new Map<string, string>()
    const idOf = (id: string) => {
      const fresh = ids.get(id) ?? newId()
      ids.set(id, fresh)
      return fresh
    }
    const seed = (kind: EntityKind, bodies: readonly { id: string }[]) => {
      for (const body of bodies) {
        const id = idOf(body.id)
        store.putUnit({
          id,
          kind,
          ownerId: null,
          body: parseUnitBody(kind, id, body),
          headSeq: 0,
          fieldSeqs: {},
          publicRead: false,
          createdAt: args.at,
          updatedAt: args.at,
          leaseId: null,
        })
      }
    }
    seed('crawler', STARTER_CRAWLERS)
    seed('pilot', STARTER_PILOTS)
    seed('mech', STARTER_MECHS)
    const [primary] = STARTER_CRAWLERS
    if (primary !== undefined) store.setPrimaryCrawlerId(idOf(primary.id))
    for (const link of STARTER_SOFT_LINKS) {
      const shape = {
        type: link.type,
        from: { type: link.from.type, id: idOf(link.from.id) },
        to: { type: link.to.type, id: idOf(link.to.id) },
      } as LinkShape
      room.units.writeLink(shape)
    }
  })
}
