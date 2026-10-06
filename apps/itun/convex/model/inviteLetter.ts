/**
 * The email an invite sends (ADR-038 §4–5) — pure `facts → { subject, text, html }`.
 *
 * It tells the recipient what the join page would tell a link holder and no
 * more: who invited them, to which Game, the seat, what is waiting, how long
 * it lasts. Never the crew — membership has not begun (ADR-030 §5).
 *
 * Deliberately plain: no images, no remote assets, no tracking. The only link
 * is the join page, and the only user-written text in it — the Game's name and
 * the inviter's display name — is escaped, because an Organizer chooses both
 * and the recipient did not ask for this mail.
 *
 * Pure: no `_generated` imports, so it is unit-tested directly.
 */

export type InviteLetterFacts = {
  code: string
  gameName: string
  invitedBy: string
  role: 'player' | 'mediator'
  grantCount: number
  expiresAt: number | null
  requiresApproval: boolean
}

export type InviteLetter = { subject: string; text: string; html: string }

const DAY_MS = 1000 * 60 * 60 * 24

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Subject lines are a single line, whatever an Organizer named their Game. */
function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').trim()
}

export function joinLink(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/join/${encodeURIComponent(code)}`
}

export function composeInviteLetter(
  facts: InviteLetterFacts,
  siteUrl: string,
  now: number
): InviteLetter {
  const link = joinLink(siteUrl, facts.code)
  const seat = facts.role === 'mediator' ? ', as its Mediator' : ''
  const waiting =
    facts.grantCount === 0
      ? null
      : facts.grantCount === 1
        ? 'A character is waiting for you.'
        : `${facts.grantCount} characters are waiting for you.`
  const days =
    facts.expiresAt === null ? null : Math.max(1, Math.ceil((facts.expiresAt - now) / DAY_MS))
  const lasts =
    days === null
      ? 'The link works once.'
      : `The link works once and expires in ${days} ${days === 1 ? 'day' : 'days'}.`
  const approval = facts.requiresApproval
    ? `${facts.invitedBy} will let you in before you can see the table.`
    : null

  const opening = `${facts.invitedBy} invited you to ${facts.gameName} on In The Union Now${seat}.`
  const why = `You are getting this because ${facts.invitedBy} typed your address into In The Union Now. If you were not expecting it, ignore it — nothing happens unless you open the link. Your address is kept only until the invite is used, declined, revoked or expires.`

  const text = [
    opening,
    waiting,
    '',
    `Open the invite: ${link}`,
    `Or join with the code ${facts.code} under "+ New game".`,
    '',
    `${lasts} You will sign in with Discord to accept.`,
    approval,
    '',
    why,
  ]
    .filter((line) => line !== null)
    .join('\n')

  const p = (inner: string) => `<p>${inner}</p>`
  const html = [
    p(
      `<strong>${escapeHtml(facts.invitedBy)}</strong> invited you to <strong>${escapeHtml(facts.gameName)}</strong> on In The Union Now${escapeHtml(seat)}.`
    ),
    waiting === null ? null : p(escapeHtml(waiting)),
    p(`<a href="${escapeHtml(link)}">Open the invite</a>`),
    p(`Or join with the code <code>${escapeHtml(facts.code)}</code> under “+ New game”.`),
    p(`${escapeHtml(lasts)} You will sign in with Discord to accept.`),
    approval === null ? null : p(escapeHtml(approval)),
    `<p style="color:#666;font-size:12px">${escapeHtml(why)}</p>`,
  ]
    .filter((part) => part !== null)
    .join('\n')

  return {
    subject: oneLine(`${facts.invitedBy} invited you to ${facts.gameName} on In The Union Now`),
    text,
    html,
  }
}
