import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalQuery } from './_generated/server'
import { internalMutation } from './model/entities'
import { composeInviteLetter } from './model/inviteLetter'
import { forgetAddress, statusOf } from './model/invites'

/**
 * Delivering an email invite (ADR-038 §4).
 *
 * `invites.sendEmail` mints the invite and schedules `send` in the same
 * transaction, so an email can never go out for an invite that does not exist.
 * `send` is an action because it is the deployment's one outbound call: it asks
 * Resend's REST API to deliver the letter with plain `fetch` — no SDK — and
 * writes the outcome back onto the invite, where the Organizer's list reads it.
 *
 * ## The key
 *
 * `RESEND_API_KEY` lives on the Convex deployment and nowhere else; it is set
 * from 1Password through `op run`, piped on stdin (see accounts-and-games.md).
 * It is read here and sent in one header, and never logged — a failure logs the
 * status code, never the request. Unset, every send records "email is not set
 * up" and the invite still works as a code.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/** The sender, unless the deployment names another (`INVITE_EMAIL_FROM`). */
const DEFAULT_FROM = 'In The Union Now <invites@intheunionnow.com>'

/** The facts the letter needs, or null when there is nothing to send any more. */
export const letter = internalQuery({
  args: { inviteId: v.id('invites') },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId)
    if (invite === null || invite.target?.kind !== 'email') return null
    const to = invite.target.address
    // Revoked, declined or spent before the action ran: the address is gone or
    // going, and sending would invite somebody to a door already shut.
    if (to === undefined || statusOf(invite, Date.now()) !== 'active') return null

    const game = await ctx.db.get(invite.gameId)
    if (game === null) return null
    const inviter = await ctx.db.get(invite.createdBy)

    return {
      to,
      facts: {
        code: invite.code,
        gameName: game.name,
        invitedBy: inviter?.displayName ?? inviter?.name ?? 'Your organizer',
        role: invite.role ?? 'player',
        grantCount: invite.grants?.length ?? 0,
        expiresAt: invite.expiresAt ?? null,
        requiresApproval: invite.requiresApproval ?? false,
      },
    }
  },
})

/** What happened to the email, for the Organizer's list. */
export const recordDelivery = internalMutation({
  args: {
    inviteId: v.id('invites'),
    state: v.union(v.literal('sent'), v.literal('failed')),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const invite = await ctx.db.get(args.inviteId)
    if (invite === null) return
    await ctx.db.patch(invite._id, {
      delivery: { state: args.state, at: Date.now(), detail: args.detail },
    })
  },
})

export const send = internalAction({
  args: {
    inviteId: v.id('invites'),
    /**
     * Distinguishes one deliberate send from another in the idempotency key, so
     * a send is never deduplicated against a different, earlier one.
     */
    attempt: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const found = await ctx.runQuery(internal.inviteEmail.letter, { inviteId: args.inviteId })
    if (found === null) return

    const key = process.env.RESEND_API_KEY
    if (key === undefined || key.length === 0) {
      await ctx.runMutation(internal.inviteEmail.recordDelivery, {
        inviteId: args.inviteId,
        state: 'failed',
        detail: 'email is not set up on this server',
      })
      return
    }

    const siteUrl = process.env.SITE_URL ?? 'https://intheunionnow.com'
    const { subject, text, html } = composeInviteLetter(found.facts, siteUrl, Date.now())

    let status: number
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `invite-${args.inviteId}-${args.attempt}`,
        },
        body: JSON.stringify({
          from: process.env.INVITE_EMAIL_FROM ?? DEFAULT_FROM,
          to: [found.to],
          subject,
          text,
          html,
        }),
      })
      status = response.status
    } catch (error) {
      // Reported to the Organizer (the invite list says it was not delivered)
      // and to the logs; the message only, never the request, which carries
      // the key.
      console.error('invite email: Resend unreachable', (error as Error).message)
      await ctx.runMutation(internal.inviteEmail.recordDelivery, {
        inviteId: args.inviteId,
        state: 'failed',
        detail: 'the email service could not be reached',
      })
      return
    }

    if (status < 200 || status >= 300) {
      console.error('invite email: Resend refused', status)
    }
    await ctx.runMutation(internal.inviteEmail.recordDelivery, {
      inviteId: args.inviteId,
      ...(status >= 200 && status < 300
        ? { state: 'sent' as const }
        : { state: 'failed' as const, detail: `the email service refused it (${status})` }),
    })
  },
})

/**
 * Forget the addresses of email invites that expired unused — the half of
 * ADR-038 §5's retention rule that no person's act triggers. Run daily by
 * `crons.ts`; bounded per run, and a backlog drains over the following days.
 */
export const forgetExpiredAddresses = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const now = Date.now()
    const expired = await ctx.db
      .query('invites')
      .withIndex('by_target_kind_expiry', (q) => q.eq('target.kind', 'email').lt('expiresAt', now))
      .take(500)

    let forgotten = 0
    for (const invite of expired) {
      if (invite.target?.kind === 'email' && invite.target.address !== undefined) {
        await forgetAddress(ctx, invite)
        forgotten += 1
      }
    }
    return forgotten
  },
})
