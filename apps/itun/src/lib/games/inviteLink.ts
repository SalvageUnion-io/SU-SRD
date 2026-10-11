/**
 * Invite links (issue 1255): a Game is joined from a link, never a typed code.
 *
 * The link is `/invite/<token>`, where the token is the invite's `code` column
 * (`convex/model/invites.ts`). It is built from the origin the page was served
 * on, so a link copied from a preview deployment opens that deployment.
 */

/** The route an invite link opens. */
export function invitePath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`
}

/** The whole link, ready to paste into a chat. */
export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}${invitePath(token)}`
}
