/**
 * InvitePanel — "Invite links" on a Game's own page, the Organizer's (board
 * M2; docs/architecture/mediator-dashboard.md Q12). An invite is a link,
 * never a typed code (issue 1255).
 *
 * Each live link is a card: its seat as a stamp (PLAYER SEAT or MEDIATOR
 * SEAT), "You approve each" when it asks first, when it expires, the link
 * itself, how often it has been used, **Copy link** and **Revoke**. Revoking
 * closes a link; it never removes anyone who has already joined. A closed
 * link (revoked, declined, expired, used up) drops to one line under them,
 * so who used it, or that its addressee declined, is still there to read.
 *
 * Under them, **New link**: the seat, when it expires (1, 7, 14 or 30 days;
 * every invite expires, so there is no "never"), and "I approve each person
 * who uses it", **unchecked by default**: ADR-030's invite amendment keeps a
 * bearer link the default, and approval is for a link posted somewhere more
 * people can read it than you intend, because joining hands over read access
 * to every crewmate's sheet (ADR-030 §5). A new link goes straight to the
 * clipboard.
 *
 * Organizer-only: the server refuses `invites.list` and `invites.create` to
 * anyone else (`requireOrganizer`), so the page renders this for them alone.
 */

import { Badge, Button, Checkbox, Field, Select, toast, tokens } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { expiresIn, usedLine } from '../../lib/games/inviteExpiry'
import { inviteUrl } from '../../lib/games/inviteLink'
import { ConvexPending } from '../shared/ConvexPending'
import { failureMessage } from '../shared/useConfirm'
import { HubSection } from './HubSection'
import { HUB_COPY } from './hubStyles'

const { borderWidth, color, font, fontSize, radius, space, tracking, weight } = tokens

type InviteRow = FunctionReturnType<typeof api.invites.list>[number]

const DAY_MS = 24 * 60 * 60 * 1000

/** How long a new link lasts. Seven days is the default, as drawn. */
const EXPIRY_CHOICES = [
  { days: 1, label: 'In 1 day' },
  { days: 7, label: 'In 7 days' },
  { days: 14, label: 'In 14 days' },
  { days: 30, label: 'In 30 days' },
] as const

/** Who an addressed invite (ADR-039) went to, and how its DM fared while live. */
function addressLine(invite: InviteRow): string | null {
  if (invite.target === null) return null
  const to = `Sent to ${invite.target.name === null ? 'a Discord account' : `@${invite.target.name}`}`
  if (invite.delivery?.state === 'failed') {
    return `${to} · DM not delivered${invite.delivery.detail === null ? '' : ` (${invite.delivery.detail})`}`
  }
  if (invite.delivery?.state === 'queued') return `${to} · DM sending`
  return to
}

const LIST: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
}

const CARD: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[10],
  padding: space[12],
  background: color.paper,
  border: `${borderWidth.chrome} solid ${color.ink}`,
  borderRadius: radius.card,
}

const HEAD: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[8],
}

const META: CSSProperties = { fontFamily: font.body, fontSize: fontSize.sm, color: color.ink }

const URL_BOX: CSSProperties = {
  display: 'block',
  padding: `${space[8]} ${space[10]}`,
  background: color.wkBg2,
  borderRadius: radius.card,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: fontSize.sm,
  color: color.ink,
  overflowWrap: 'anywhere',
}

const FOOT: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space[8],
}

const MUTED: CSSProperties = { ...META, color: color.wkMuted }

const ACTIONS: CSSProperties = { display: 'flex', gap: space[6] }

const CLOSED: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[4],
}

const NEW_LINK: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  padding: space[12],
  border: `${borderWidth.chrome} dashed ${color.ink50}`,
  borderRadius: radius.card,
}

const NEW_HEAD: CSSProperties = {
  margin: 0,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
  color: color.ink,
}

const PAIR: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 9rem), 1fr))',
  gap: space[12],
}

const FULL: CSSProperties = { width: '100%' }

type InvitePanelProps = {
  gameId: Id<'games'>
  /** Injectable clipboard writer for testing. */
  clipboardWriter?: (text: string) => Promise<void>
}

export function InvitePanel({
  gameId,
  clipboardWriter = (text) => navigator.clipboard.writeText(text),
}: InvitePanelProps) {
  const id = useId()
  const invites = useQuery(api.invites.list, { gameId })
  const createInvite = useMutation(api.invites.create)
  const revoke = useMutation(api.invites.revoke)
  const { canWrite } = useConnection()

  const [role, setRole] = useState<'player' | 'mediator'>('player')
  const [days, setDays] = useState<number>(7)
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [making, setMaking] = useState(false)

  const now = Date.now()
  const origin = window.location.origin

  const copy = (token: string) => {
    // Through a resolved promise, so a clipboard API that throws rather than
    // rejecting (none at all, in an insecure context) lands in the catch too.
    void Promise.resolve()
      .then(() => clipboardWriter(inviteUrl(origin, token)))
      .then(() => toast.success('Invite link copied', { id: 'invite-link-copy', duration: 2000 }))
      .catch(() =>
        toast.error('Could not copy. Select the link on its card and copy it from there.', {
          id: 'invite-link-copy',
        })
      )
  }

  const make = () => {
    setMaking(true)
    void createInvite({ gameId, role, requiresApproval, expiresInMs: days * DAY_MS })
      .then((token) => {
        setRole('player')
        setDays(7)
        setRequiresApproval(false)
        // A new link is made to be sent, so it goes straight to the clipboard.
        copy(token)
      })
      .catch((err: unknown) =>
        toast.error(failureMessage(err, 'The link could not be made. Try again.'), {
          id: 'invite-link-make',
        })
      )
      .finally(() => setMaking(false))
  }

  const live = invites?.filter((invite) => invite.status === 'active') ?? []
  const closed = invites?.filter((invite) => invite.status !== 'active') ?? []

  return (
    <HubSection id="invite-links-heading" title="Invite links">
      {invites === undefined && <ConvexPending label="the invite links" />}
      {invites !== undefined && live.length === 0 && (
        <p style={HUB_COPY}>
          No open links. Make one below and send it to whoever you want at the table.
        </p>
      )}
      {live.length > 0 && (
        <ul style={LIST} aria-label="Open invite links">
          {live.map((invite) => {
            const seat = invite.role === 'mediator' ? 'Mediator seat' : 'Player seat'
            const url = inviteUrl(origin, invite.code)
            return (
              <li key={invite._id} style={CARD}>
                <div style={HEAD}>
                  <Badge shape="stamp" size="mini">
                    {seat}
                  </Badge>
                  <span style={META}>
                    {[
                      invite.label,
                      invite.requiresApproval ? 'You approve each' : 'Anyone with it joins',
                      invite.grantCount > 0 ? `${invite.grantCount} handed over` : null,
                      expiresIn(invite.expiresAt, now),
                    ]
                      .filter((part) => part !== null)
                      .join(' · ')}
                  </span>
                </div>
                <code style={URL_BOX}>{url.replace(/^https?:\/\//, '')}</code>
                <div style={FOOT}>
                  <span style={MUTED}>
                    {[
                      usedLine(invite.redeemers.length),
                      invite.redeemers.length > 0 ? `by ${invite.redeemers.join(', ')}` : null,
                      addressLine(invite),
                    ]
                      .filter((part) => part !== null)
                      .join(' · ')}
                  </span>
                  <span style={ACTIONS}>
                    <Button
                      variant="primary"
                      size="compact"
                      aria-label={`Copy ${seat.toLowerCase()} link`}
                      onClick={() => copy(invite.code)}
                    >
                      Copy link
                    </Button>
                    <Button
                      variant="default"
                      size="compact"
                      disabled={!canWrite}
                      aria-label={`Revoke ${seat.toLowerCase()} link`}
                      onClick={() =>
                        void revoke({ inviteId: invite._id }).catch((err: unknown) =>
                          toast.error(failureMessage(err, 'That link is still open. Try again.'), {
                            id: 'invite-link-revoke',
                          })
                        )
                      }
                    >
                      Revoke
                    </Button>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {closed.length > 0 && (
        <ul style={CLOSED} aria-label="Closed invite links">
          {closed.map((invite) => (
            <li key={invite._id} style={MUTED}>
              {[
                invite.role === 'mediator' ? 'Mediator seat' : 'Player seat',
                invite.label,
                invite.status,
                invite.target === null
                  ? null
                  : `sent to ${invite.target.name === null ? 'a Discord account' : `@${invite.target.name}`}`,
                invite.redeemers.length > 0 ? `used by ${invite.redeemers.join(', ')}` : null,
              ]
                .filter((part) => part !== null)
                .join(' · ')}
            </li>
          ))}
        </ul>
      )}
      <p style={HUB_COPY}>
        Revoking closes a link. It never removes anyone who has already joined.
      </p>

      <section aria-labelledby={`${id}-new`} style={NEW_LINK}>
        <h3 id={`${id}-new`} style={NEW_HEAD}>
          New link
        </h3>
        <div style={PAIR}>
          <Field label="Seat" htmlFor={`${id}-seat`}>
            <Select
              id={`${id}-seat`}
              value={role}
              onChange={(e) => setRole(e.target.value === 'mediator' ? 'mediator' : 'player')}
            >
              <option value="player">Player</option>
              <option value="mediator">Mediator</option>
            </Select>
          </Field>
          <Field label="Expires" htmlFor={`${id}-expires`}>
            <Select
              id={`${id}-expires`}
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {EXPIRY_CHOICES.map((choice) => (
                <option key={choice.days} value={choice.days}>
                  {choice.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Checkbox
          label="I approve each person who uses it"
          checked={requiresApproval}
          onChange={(e) => setRequiresApproval(e.target.checked)}
        />
        <p style={HUB_COPY}>
          {requiresApproval
            ? 'Whoever opens it asks to join and waits for you. Use this for a link you post somewhere public.'
            : 'Whoever opens it joins as soon as they sign in. Members can read every crewmate’s sheet, so share it like a key.'}
        </p>
        <Button
          variant="default"
          size="full"
          style={FULL}
          disabled={!canWrite || making}
          onClick={make}
        >
          Make link
        </Button>
      </section>
    </HubSection>
  )
}
