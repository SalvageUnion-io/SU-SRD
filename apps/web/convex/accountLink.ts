import { ConvexError, v } from 'convex/values'
import { DISCORD_SUBJECT, LINK_ISSUER, TEST_SUBJECT } from 'game-domain/authWire'
import { mutation } from './model/entities'

/**
 * The sign-in's bridge while Convex is still the server of record:
 * the site Worker signs a player in and calls this, server to server, with a
 * link token naming the account (`src/worker/auth/`). It answers the
 * account's `users` id, made on a first sign-in, and the Worker mints session
 * tokens for that id.
 *
 * The rows are the ones Convex Auth wrote: an `authAccounts` row per sign-in
 * (`discord` keyed by the Discord id, `password` keyed by a test account's
 * email), so everyone who signed in before finds their own account, and the
 * bot and `ADMIN_DISCORD_IDS` (`model/admin.ts`) keep reading Discord ids
 * from it. A sign-in refreshes the profile, as Convex Auth's did.
 */
export const link = mutation({
  args: {},
  returns: v.id('users'),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null || identity.issuer !== LINK_ISSUER)
      throw new ConvexError('accountLink.link takes a link token')
    const { subject } = identity
    let provider: 'discord' | 'password'
    let accountId: string
    if (subject.startsWith(DISCORD_SUBJECT)) {
      provider = 'discord'
      accountId = subject.slice(DISCORD_SUBJECT.length)
    } else if (subject.startsWith(TEST_SUBJECT) && process.env.TEST_AUTH === 'true') {
      // Never production's: the test seam needs `TEST_AUTH` here and on the Worker.
      provider = 'password'
      accountId = subject.slice(TEST_SUBJECT.length)
    } else {
      throw new ConvexError('accountLink.link: not an account this deployment signs in')
    }

    const profile = Object.fromEntries(
      Object.entries({
        name: identity.name,
        image: identity.pictureUrl,
        email: identity.email,
      }).filter(([, value]) => typeof value === 'string')
    )
    const existing = await ctx.db
      .query('authAccounts')
      .withIndex('providerAndAccountId', (q) =>
        q.eq('provider', provider).eq('providerAccountId', accountId)
      )
      .unique()
    if (existing !== null) {
      await ctx.db.patch(existing.userId, profile)
      return existing.userId
    }
    const userId = await ctx.db.insert('users', profile)
    await ctx.db.insert('authAccounts', { userId, provider, providerAccountId: accountId })
    return userId
  },
})
