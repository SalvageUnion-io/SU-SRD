import type { Infer } from 'convex/values'
import { ConvexError, v } from 'convex/values'
import {
  FEEDBACK_DAILY_LIMIT,
  FEEDBACK_MAX,
  FEEDBACK_MIN,
  FEEDBACK_REFUSAL,
  FEEDBACK_REPO,
  FEEDBACK_THANKS,
  issueFor,
  pagePath,
} from 'game-domain/feedback'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalAction } from './_generated/server'
import { internalMutation, mutation } from './model/entities'
import { requireUser } from './model/permissions'
import { feedbackKind } from './model/signalTables'

/**
 * "Suggest or report" and `/su feedback` (ADR-057): a player's note becomes a
 * labelled issue on the public SU-SRD repository, with no name on it.
 *
 * A note is written to `feedback` first and filed by an action, so a GitHub
 * outage or a missing token loses nothing: the hourly `sweep` files whatever
 * is still waiting. The text goes once filed, and the row once it is a day
 * old, which is as long as the per-sender limit needs it.
 */

const DAY = 86_400_000

/** A note that could not be filed for this long is dropped rather than held. */
const GIVE_UP_AFTER = 7 * DAY

/**
 * How long one filing holds its note (`claim`): longer than an action may
 * run, so a second `file` (the sweep's, beside `accept`'s) never posts the
 * same note while the first is still talking to GitHub.
 */
const CLAIM_FOR = 15 * 60_000

type Kind = Infer<typeof feedbackKind>

/** Check the note and the sender's day, write the row, and file it straight away. */
async function accept(
  ctx: MutationCtx,
  note: { sender: string; source: 'app' | 'bot'; kind: Kind; text: string; page: string | null }
): Promise<Id<'feedback'>> {
  const text = note.text.trim()
  if (text.length < FEEDBACK_MIN) throw new ConvexError(FEEDBACK_REFUSAL.short)
  if (text.length > FEEDBACK_MAX) throw new ConvexError(FEEDBACK_REFUSAL.long)
  const now = Date.now()
  const today = await ctx.db
    .query('feedback')
    .withIndex('by_sender_created', (q) => q.eq('sender', note.sender).gte('createdAt', now - DAY))
    .take(FEEDBACK_DAILY_LIMIT)
  if (today.length >= FEEDBACK_DAILY_LIMIT) throw new ConvexError(FEEDBACK_REFUSAL.limit)

  const id = await ctx.db.insert('feedback', {
    ...note,
    text,
    createdAt: now,
    issue: null,
    attempts: 0,
  })
  await ctx.scheduler.runAfter(0, internal.feedback.file, { id })
  return id
}

/** The app's "Suggest or report". Signed in only: the limit counts accounts. */
export const submit = mutation({
  args: {
    kind: feedbackKind,
    text: v.string(),
    /** The app path it was sent from, so a report says where. */
    page: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    await accept(ctx, {
      sender: `user:${userId}`,
      source: 'app',
      kind: args.kind,
      text: args.text,
      page: pagePath(args.page),
    })
    return null
  },
})

/**
 * `/su feedback`, through the bot's door (`botHttp.ts`). Anybody on Discord
 * may send one, linked or not; the limit counts their Discord id. A refusal
 * is an answer (`accepted: false`) for the bot to show, not a throw.
 */
export const fromBot = internalMutation({
  args: { discordId: v.string(), kind: feedbackKind, text: v.string() },
  returns: v.object({ ok: v.literal(true), accepted: v.boolean(), message: v.string() }),
  handler: async (ctx, args) => {
    try {
      await accept(ctx, {
        sender: `discord:${args.discordId}`,
        source: 'bot',
        kind: args.kind,
        text: args.text,
        page: null,
      })
      return { ok: true as const, accepted: true, message: FEEDBACK_THANKS }
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === 'string') {
        return { ok: true as const, accepted: false, message: error.data }
      }
      throw error
    }
  },
})

/**
 * Claim a waiting note for one `file`: the note, or null when it is filed,
 * gone, or another filing holds it.
 */
export const claim = internalMutation({
  args: { id: v.id('feedback') },
  returns: v.union(
    v.object({
      kind: feedbackKind,
      source: v.union(v.literal('app'), v.literal('bot')),
      text: v.string(),
      page: v.union(v.string(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id)
    if (row === null || row.issue !== null || row.text === null) return null
    const now = Date.now()
    if (row.filingSince !== undefined && now - row.filingSince < CLAIM_FOR) return null
    await ctx.db.patch(id, { filingSince: now })
    return { kind: row.kind, source: row.source, text: row.text, page: row.page }
  },
})

/**
 * Record the outcome of one filing: the issue number (and drop the text), or
 * one more attempt, letting the next sweep claim it again.
 */
export const filed = internalMutation({
  args: { id: v.id('feedback'), issue: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { id, issue }) => {
    const row = await ctx.db.get(id)
    if (row === null) return null
    if (issue === null)
      await ctx.db.patch(id, { attempts: row.attempts + 1, filingSince: undefined })
    else await ctx.db.patch(id, { issue, text: null })
    return null
  },
})

/**
 * File one note as a GitHub issue with `GITHUB_FEEDBACK_TOKEN` (a token that
 * may open issues on `FEEDBACK_REPO`). Unset, it does nothing and the note
 * waits for the sweep; a refusal counts an attempt and throws, so it reaches
 * Workers Issues through the log stream.
 */
export const file = internalAction({
  args: { id: v.id('feedback') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const token = process.env.GITHUB_FEEDBACK_TOKEN
    if (token === undefined || token.length === 0) return null
    const note = await ctx.runMutation(internal.feedback.claim, { id })
    if (note === null) return null

    const response = await fetch(`https://api.github.com/repos/${FEEDBACK_REPO}/issues`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'salvageunion.io feedback',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(issueFor(note)),
    })
    if (!response.ok) {
      await ctx.runMutation(internal.feedback.filed, { id, issue: null })
      throw new Error(`Filing feedback failed: GitHub answered ${response.status}`)
    }
    const { number } = (await response.json()) as { number: number }
    await ctx.runMutation(internal.feedback.filed, { id, issue: number })
    return null
  },
})

/**
 * Hourly: file what is still waiting, delete filed rows a day old, and drop a
 * note that has waited a week (the token is missing or GitHub keeps refusing).
 */
export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now()
    for await (const row of ctx.db
      .query('feedback')
      .withIndex('by_created', (q) => q.lt('createdAt', now))) {
      const age = now - row.createdAt
      if (row.issue !== null) {
        if (age > DAY) await ctx.db.delete(row._id)
      } else if (age > GIVE_UP_AFTER) {
        await ctx.db.delete(row._id)
      } else {
        await ctx.scheduler.runAfter(0, internal.feedback.file, { id: row._id })
      }
    }
    return null
  },
})

/** Delete every note an account sent, from the app or its Discord id (`account.deleteAccount`). */
export async function deleteFeedbackOf(ctx: MutationCtx, userId: Id<'users'>): Promise<void> {
  const discord = await ctx.db
    .query('authAccounts')
    .withIndex('userIdAndProvider', (q) => q.eq('userId', userId).eq('provider', 'discord'))
    .take(4)
  const senders = [`user:${userId}`, ...discord.map((a) => `discord:${a.providerAccountId}`)]
  for (const sender of senders) {
    for await (const row of ctx.db
      .query('feedback')
      .withIndex('by_sender_created', (q) => q.eq('sender', sender))) {
      await ctx.db.delete(row._id)
    }
  }
}
