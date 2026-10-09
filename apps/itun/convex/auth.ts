import Discord from '@auth/core/providers/discord'
import type { User } from '@auth/core/types'
import { Password } from '@convex-dev/auth/providers/Password'
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
 * Signed out, ITUN is read-only; building anything needs an account
 * ([ADR-034](../../../docs/ARCHITECTURE.md#adr-034), as amended). Discord is
 * the only door for real users — see `testOnlyProviders` below for the one
 * exception and why it is not one.
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
 * Discord's issuer, as its `/.well-known/openid-configuration` declares it.
 *
 * Discord now appends the RFC 9207 `iss` parameter to its authorization
 * response, and `oauth4webapi` rejects a callback whose `iss` differs from the
 * provider's issuer. The stock provider declares none, so `@convex-dev/auth`
 * falls back to the placeholder `theremustbeastringhere.dev` — and every
 * sign-in failed with `unexpected "iss" (issuer) response parameter value`,
 * logged rather than thrown, so nothing reached Sentry. Setting it does not
 * trigger discovery: the provider already names all three endpoints, so this
 * only changes what `iss` is compared against.
 */
const DISCORD_ISSUER = 'https://discord.com'

/**
 * Auth.js types `OAuthConfig.profile` as optional, because a provider may lean
 * on the generic default mapping. Discord does not — it ships its own, and that
 * is the function being wrapped. Asserting here rather than at the call site
 * means a library change that dropped it fails loudly at deploy, instead of
 * silently reinstating the `null` email this module exists to strip.
 */
const { profile: rawDiscordProfile } = discord
if (!rawDiscordProfile) {
  throw new Error(
    '@auth/core Discord provider no longer defines profile(); the null-field guard has nothing to wrap'
  )
}

/**
 * The same function, bound after the guard so its *type* carries the proof.
 *
 * `providersFor` is a hoisted function declaration, so TypeScript will not
 * assume the guard above has run by the time its body executes, and drops the
 * narrowing at the call inside it. Re-binding here is what makes the proof
 * survive into that closure.
 */
const discordProfile: NonNullable<typeof discord.profile> = rawDiscordProfile

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

/**
 * A password provider that exists **only so end-to-end tests can sign in**.
 *
 * ## Why this has to exist at all
 *
 * ADR-034 gates building on an account. `e2e/signin-save.e2e.ts` pins both
 * halves of that in a browser: signed out, a wizard asks you to sign in instead
 * of building; signed in, what you build is durable. Every other e2e spec that
 * builds something signs in the same way (`e2e/fixtures.ts`). With Discord
 * OAuth as the only provider there is no credential a Playwright fixture could
 * present, so without this provider none of those specs could run.
 *
 * ## Why it is not a second door into real accounts
 *
 * It is included **only** when `ITUN_TEST_AUTH` is exactly `'true'` on the
 * deployment. Production never sets it, and `test/convex/authProviders.test.ts`
 * asserts that a deployment without it exposes Discord and nothing else — an
 * assertion, not a comment, because a comment cannot fail.
 *
 * Three properties make the blast radius small even if the flag were set by
 * mistake:
 *
 *  - It grants no authority of its own. A password account is an ordinary user
 *    with an ordinary empty shelf; every capability in this app comes from
 *    membership of a Game (`model/permissions.ts`), which such an account has
 *    none of.
 *  - It cannot reach an existing Discord account. Convex Auth links accounts by
 *    provider, so signing in with a password mints a *separate* user; there is
 *    no email-matching path that would let it land inside somebody's roster.
 *  - It is env-gated at module scope, so a deployment either has it or does not
 *    — there is no request-time input that could flip it.
 *
 * **Read as a rule rather than a description: never make this conditional on
 * anything a request can influence, and never set `ITUN_TEST_AUTH` on the
 * production deployment.**
 */
const testAuthEnabled = process.env.ITUN_TEST_AUTH === 'true'

/**
 * Exported for the test that asserts production exposes Discord alone. Callers
 * outside that test have no reason to read it, and `providersFor` is the thing
 * that actually decides.
 */
export function providersFor(testAuth: boolean) {
  type DiscordProfileFn = typeof discordProfile

  const discordProvider = {
    ...discord,
    issuer: DISCORD_ISSUER,
    profile: async (
      raw: Parameters<DiscordProfileFn>[0],
      tokens: Parameters<DiscordProfileFn>[1]
    ) => withoutNullFields(await discordProfile(raw, tokens)),
  }
  return testAuth ? [discordProvider, Password()] : [discordProvider]
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: providersFor(testAuthEnabled),
})
