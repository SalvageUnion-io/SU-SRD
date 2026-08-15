import Discord from '@auth/core/providers/discord'
import type { User } from '@auth/core/types'
import { convexAuth } from '@convex-dev/auth/server'

/**
 * Discord OAuth sign-in (D3).
 *
 * Discord is the only provider, deliberately: the audience already lives there,
 * the project ships a Discord bot, and using one identity makes that bot a
 * first-class authenticated Game client rather than something needing its own
 * credential story. No passwords, no reset flows, no deliverability problems.
 *
 * Requires AUTH_DISCORD_ID / AUTH_DISCORD_SECRET on the deployment:
 *   bunx convex env set AUTH_DISCORD_ID <client-id>
 *   bunx convex env set AUTH_DISCORD_SECRET <client-secret>
 *
 * Signing in is an *upgrade*, never a gate (D10) — anonymous solo play stays
 * first-class and needs none of this.
 */
/**
 * No `afterUserCreatedOrUpdated` callback stamps the Discord snowflake here,
 * and deliberately so: `@convex-dev/auth` destructures `id` out of the OAuth
 * profile before any callback sees it, so such a stamp is always `undefined`
 * and fails silently. The bot resolves a Discord id through `authAccounts`
 * instead — see `model/bot.ts#userByDiscordId`.
 */

/**
 * The stock Discord provider, materialized so its `profile()` can be wrapped.
 *
 * `Discord` is a factory; `convexAuth` accepts either the factory or a
 * materialized config, so calling it here costs nothing and is the only way to
 * delegate to the default mapping instead of reimplementing it. That mapping is
 * not trivial — it derives the CDN avatar URL, including the legacy
 * discriminator maths for default avatars — so re-declaring `profile()` from
 * scratch would fork logic that belongs to the library.
 */
const discord = Discord({})

/**
 * Auth.js types `OAuthConfig.profile` as optional, because a provider may lean
 * on the generic default mapping. Discord does not — it ships its own, and that
 * is the function being wrapped. Asserting here rather than at the call site
 * means a library change that dropped it fails loudly at deploy, instead of
 * silently reinstating the `null` email this module exists to strip.
 */
const { profile: discordProfile } = discord
if (!discordProfile) {
  throw new Error(
    '@auth/core Discord provider no longer defines profile(); the null-field guard has nothing to wrap'
  )
}

/**
 * Strips `null` values out of an OAuth profile before it becomes a `users` row.
 *
 * `@convex-dev/auth` spreads the provider's profile straight into
 * `ctx.db.insert('users', …)` (`implementation/users.ts`), and every column on
 * that table is `v.optional(v.string())` — which admits `undefined` or an
 * absent key, but **not** `null`. Auth.js models "the provider has no value for
 * this field" as `null`, so the two conventions disagree on exactly the case
 * that matters.
 *
 * Discord hits it: its `profile()` maps `email: profile.email` verbatim, and
 * Discord returns `email: null` for an account with no verified address. The
 * result was not a missing email — it was a schema violation thrown from inside
 * the auth mutation, so **sign-in failed outright** for that account and there
 * was no way for the player to get past it (issue ITUN-CONVEX-2).
 *
 * Dropping the key rather than widening the validator is the right side of that
 * disagreement to fix. `defaultCreateOrUpdateUser` guards its account-linking
 * lookups with `typeof profile.email === 'string'`, so an absent email is a
 * shape it already handles; a stored `null` would instead sit in the `email`
 * index forever and make every reader of that column handle a third state.
 */
function withoutNullFields(profile: User): User {
  return Object.fromEntries(Object.entries(profile).filter(([, value]) => value !== null)) as User
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    {
      ...discord,
      profile: async (raw, tokens) => withoutNullFields(await discordProfile(raw, tokens)),
    },
  ],
})
