/**
 * Invite links: a Game is joined from a link, never a typed code.
 *
 * The link is `/invite/<token>`, where the token is the invite's `code` column
 * (`convex/model/invites.ts`). It is built from the origin the page was served
 * on, so a link copied from a preview deployment opens that deployment.
 */

/** The route an invite link opens. */
export function invitePath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`
}

/**
 * The token in what a player pasted to join (the Play hub's Join): a whole
 * invite link (`…/invite/<token>`, any origin, a trailing slash or query
 * ignored), or the token alone; a token is letters and digits
 * (`convex/model/invites.ts`). `null` when it is neither: the field says so
 * rather than opening a page that can only answer "dead link".
 */
export function inviteTokenFrom(pasted: string): string | null {
  const text = pasted.trim()
  const inLink = /\/invite\/([^/?#\s]+)/.exec(text)?.[1]
  const token = inLink ?? text
  return /^[A-Za-z0-9]{6,}$/.test(token) ? token : null
}

/** The whole link, ready to paste into a chat. */
export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}${invitePath(token)}`
}
