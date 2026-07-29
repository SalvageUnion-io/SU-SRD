import Discord from '@auth/core/providers/discord'
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
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Discord],
})
