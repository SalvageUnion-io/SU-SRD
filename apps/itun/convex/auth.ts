import Discord from '@auth/core/providers/discord'
import { convexAuth } from '@convex-dev/auth/server'

import type { MutationCtx } from './_generated/server'
import { stampDiscordId } from './model/bot'

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
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Discord],
  callbacks: {
    /**
     * Stamp `users.discordId` on every sign-in, so the Discord bot can find
     * this account (ADR-030 Phase 6).
     *
     * There is deliberately **no "link your Discord account" flow**. Discord is
     * the only provider, so Auth.js has already written the snowflake to
     * `authAccounts.providerAccountId` by the time anyone could be asked to
     * paste it — asking would be asking somebody to re-key a value we hold.
     *
     * Written on every sign-in rather than only on creation: accounts that
     * predate this callback get stamped the next time their owner appears, and
     * `backfillDiscordIds` catches the rest.
     *
     * Best-effort by design. `stampDiscordId` refuses rather than throws on a
     * collision, and an unusable profile is skipped, because the cost of
     * getting this wrong must never be a failed sign-in — the bot degrades,
     * the app does not.
     */
    async afterUserCreatedOrUpdated(ctx, { userId, profile }) {
      const discordId = profile.id
      if (typeof discordId !== 'string' || discordId.length === 0) return
      await stampDiscordId(ctx as MutationCtx, userId, discordId)
    },
  },
})
