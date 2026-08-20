import { v } from 'convex/values'
import {
  STARTER_CRAWLERS,
  STARTER_MECHS,
  STARTER_PILOTS,
  STARTER_SOFT_LINKS,
} from '../src/lib/starterSet/starterSet'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireUser } from './model/permissions'

/**
 * Game templates (ADR-030, D34).
 *
 * A template is a pre-built crew you can start a Game from. The rule that makes
 * it more than seeded data: **its entities arrive unclaimed** (`ownerId: null`).
 * The Mediator — or the Organizer, while a Game has no Mediator — hands them
 * out as players join, which turns pre-generated characters from a curiosity
 * into the onboarding path.
 *
 * The Starter Set data is imported straight from `src/lib/starterSet/`. That
 * module is deliberately static plain data with no runtime reference-data
 * resolution (see its header), so it bundles into a Convex function safely and
 * there is exactly one copy of the roster rather than a server-side duplicate
 * that would drift from the local one.
 */

const TEMPLATES = {
  'starter-set': {
    name: "Reclamation of the Wastes — Union Crawler #430 'Tenacity'",
    description:
      'The six pilots of the Salvage Union Starter Set, their mechs, and their crawler. Everyone arrives unclaimed for you to hand out.',
  },
} as const

export type TemplateId = keyof typeof TEMPLATES

/** The templates a Game can be started from. */
export const list = query({
  args: {},
  handler: async () => {
    // `id` is typed as the TemplateId union rather than `string` so a caller can
    // pass the row straight to `createGame`. With a plain `string` the only way
    // to satisfy that mutation's `v.literal` validator was to hardcode the id at
    // the call site, which meant the lobby rendered one template and created
    // another the moment a second one existed. Typed this way, adding a template
    // widens the union and `createGame`'s validator becomes the type error —
    // which is the right place to notice.
    return Object.entries(TEMPLATES).map(([id, t]) => ({
      id: id as TemplateId,
      name: t.name,
      description: t.description,
    }))
  },
})

/**
 * Create a Game pre-populated from a template.
 *
 * The creator becomes its Organizer and is seated as a Player, exactly as
 * `games.create` does — a template changes what is *in* the Game, never who
 * runs it. `mediator` starts false, so the Organizer fallback covers handing
 * out the pre-gens until somebody is appointed.
 */
export const createGame = mutation({
  args: {
    templateId: v.literal('starter-set'),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<'games'>> => {
    const userId = await requireUser(ctx)
    const template = TEMPLATES[args.templateId]

    const gameId = await ctx.db.insert('games', {
      name: args.name?.trim() || template.name,
      templateOrigin: args.templateId,
    })
    await ctx.db.insert('memberships', {
      gameId,
      userId,
      mediator: false,
      organizer: true,
      joinedAt: Date.now(),
    })

    const now = Date.now()

    // ownerId: null is the whole point — see the module header.
    for (const pilot of STARTER_PILOTS) {
      await ctx.db.insert('pilots', { gameId, ownerId: null, body: pilot, updatedAt: now })
    }
    for (const mech of STARTER_MECHS) {
      await ctx.db.insert('mechs', { gameId, ownerId: null, body: mech, updatedAt: now })
    }
    // `ownerId: null` is what communal means for a crawler in a Game (D8) — the
    // same value the starter pilots and mechs take above, but for a different
    // reason: they are unclaimed and waiting for a taker, the crawler is the
    // crew's and never gets handed to anyone.
    for (const crawler of STARTER_CRAWLERS) {
      await ctx.db.insert('crawlers', { gameId, ownerId: null, body: crawler, updatedAt: now })
    }
    for (const link of STARTER_SOFT_LINKS) {
      await ctx.db.insert('softLinks', {
        gameId,
        from: { type: link.from.type, id: link.from.id },
        to: { type: link.to.type, id: link.to.id },
        type: link.type,
      })
    }

    return gameId
  },
})
