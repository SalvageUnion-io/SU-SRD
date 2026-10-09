import type { ContainerData } from './container.js'
import { NEUTRAL_ACCENT } from './format.js'
import type { InviteResult } from './itun/types.js'

/**
 * The DM `/su invite @user` sends (ADR-039) — pure `data → ContainerData`.
 *
 * It says what the invite's landing page says before anyone signs in, and no
 * more: who invited you, to which Game, in which seat, what is waiting, how
 * long it lasts. Never the crew — membership has not begun (ADR-030 §5).
 *
 * The link is safe to sit in a DM, or to be forwarded by mistake: the invite
 * is addressed to this Discord account, and nobody else can redeem it.
 */

export type InvitedResult = Extract<InviteResult, { outcome: 'invited' }>

const DAY_MS = 1000 * 60 * 60 * 24

/** The web page an invite code opens. */
export function joinUrl(webUrl: string, code: string): string {
  return `${webUrl.replace(/\/+$/, '')}/join/${encodeURIComponent(code)}`
}

/** Discord markdown is live in a TextDisplay; a Game called `**x**` must not bold. */
function plain(text: string): string {
  return text.replace(/([\\*_~`|>#[\]()-])/g, '\\$1')
}

function expiryLine(expiresAt: number | null, now: number): string | null {
  if (expiresAt === null) return null
  const days = Math.ceil((expiresAt - now) / DAY_MS)
  if (days <= 1) return 'It expires within a day.'
  return `It expires in ${days} days.`
}

export function buildInviteDm(
  invite: InvitedResult,
  webUrl: string,
  now: number = Date.now()
): ContainerData {
  const seat = invite.role === 'mediator' ? ' as its **Mediator**' : ''
  const waiting =
    invite.grantCount === 0
      ? null
      : invite.grantCount === 1
        ? 'A character is waiting for you.'
        : `${invite.grantCount} characters are waiting for you.`

  return {
    accent: NEUTRAL_ACCENT,
    blocks: [
      {
        kind: 'text',
        content: `**${plain(invite.invitedBy)}** invited you to **${plain(invite.gameName)}**${seat} on In The Union Now.`,
      },
      {
        kind: 'text',
        content: [
          waiting,
          'Sign in with this Discord account to accept — the invite is yours alone.',
          expiryLine(invite.expiresAt, now),
        ]
          .filter((line) => line !== null)
          .join('\n'),
      },
      {
        kind: 'buttons',
        buttons: [{ kind: 'link', url: joinUrl(webUrl, invite.code), label: 'Open invite' }],
      },
    ],
  }
}
