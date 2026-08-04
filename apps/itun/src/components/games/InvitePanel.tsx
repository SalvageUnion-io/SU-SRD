import { useState } from 'react'
import { Badge, Button, Text } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { INPUT, ROW, STAMP } from './gameChrome'

/**
 * Invite management — mint, read back, and revoke.
 *
 * The screen this replaces could only mint: it showed a code once and then
 * forgot it, so an Organizer could not see what was outstanding, how many uses
 * were left, or kill one that had leaked. `revoke` existed on the server the
 * whole time with nothing calling it.
 *
 * Two doors are offered per invite, and which one to use is a judgement about
 * where the code is going rather than a setting to leave alone:
 *
 *   - **Bearer** — the code IS the authority. Right for reading aloud at a
 *     table or DMing someone you know.
 *   - **Approval** — the code only identifies the Game. Right for anywhere
 *     more people can read it than you intend, because joining hands over
 *     read access to every crewmate's sheet (ADR-030 §5).
 */

function humanExpiry(expiresAt: number | null): string {
  if (expiresAt === null) return 'no expiry'
  const days = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'expired'
  return `${days} ${days === 1 ? 'day' : 'days'} left`
}

function humanUses(usesRemaining: number | null): string {
  if (usesRemaining === null) return 'unlimited uses'
  return `${usesRemaining} ${usesRemaining === 1 ? 'use' : 'uses'} left`
}

/** Status → the badge tone that reads right: only `active` is good news. */
const STATUS_TONE = {
  active: 'ok',
  revoked: 'bad',
  expired: 'warn',
  exhausted: 'warn',
} as const

export function InvitePanel({ gameId }: { gameId: Id<'games'> }) {
  const invites = useQuery(api.invites.list, { gameId })
  const requests = useQuery(api.invites.pendingRequests, { gameId })
  const createInvite = useMutation(api.invites.create)
  const revoke = useMutation(api.invites.revoke)
  const decide = useMutation(api.invites.decideRequest)

  const [label, setLabel] = useState('')
  const [role, setRole] = useState<'player' | 'mediator'>('player')
  const [requiresApproval, setRequiresApproval] = useState(false)

  const mint = () => {
    void createInvite({
      gameId,
      label: label.trim() === '' ? undefined : label.trim(),
      role,
      requiresApproval,
    }).then(() => {
      setLabel('')
      setRole('player')
      setRequiresApproval(false)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className={STAMP}>Note (optional)</span>
            <input
              aria-label="Invite note"
              placeholder="for Sam"
              className={INPUT}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={STAMP}>Seat</span>
            <select
              aria-label="Invite seat"
              className={INPUT}
              value={role}
              onChange={(e) => setRole(e.target.value === 'mediator' ? 'mediator' : 'player')}
            >
              <option value="player">Player</option>
              <option value="mediator">Mediator</option>
            </select>
          </label>
          <label className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              aria-label="Require approval"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
            />
            <span className="font-body text-sm">Require my approval</span>
          </label>
          <Button variant="primary" size="compact" onClick={mint}>
            Create invite code
          </Button>
        </div>
        <Text variant="hint" className="text-left">
          {requiresApproval
            ? 'Anyone with this code asks to join, and waits for you. Use this for a code you post somewhere public.'
            : 'Anyone with this code joins immediately. Members can read every crewmate’s sheet, so share it like a key.'}
        </Text>
      </div>

      {requests !== undefined && requests.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={STAMP}>Asking to join</span>
          {requests.map((request) => (
            <div key={request._id} className={ROW}>
              <Text as="span">
                {request.displayName}
                {request.inviteLabel === null ? '' : ` · ${request.inviteLabel}`}
              </Text>
              <span className="flex items-center gap-2">
                {request.role === 'mediator' && (
                  <Badge surface="tone" tone="game">
                    Mediator seat
                  </Badge>
                )}
                <Button
                  variant="primary"
                  size="mini"
                  onClick={() => void decide({ requestId: request._id, approve: true })}
                >
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  size="mini"
                  onClick={() => void decide({ requestId: request._id, approve: false })}
                >
                  Decline
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className={STAMP}>Codes</span>
        {invites === undefined && <Text variant="hint">Loading…</Text>}
        {invites?.length === 0 && (
          <Text variant="hint" className="text-left">
            No invite codes yet.
          </Text>
        )}
        {invites?.map((invite) => (
          <div key={invite._id} className={ROW}>
            <span className="flex flex-col gap-0.5">
              {/* Crockford base32 with no I/L/O/U, so a code read aloud across a
                  table cannot be mistyped into a different valid one. Rendered
                  large and spaced because reading it aloud is a primary use. */}
              <Text as="span" className="font-cond text-xl font-bold tracking-caps-wide">
                {invite.code}
              </Text>
              <Text variant="hint" className="text-left">
                {[
                  invite.label,
                  invite.role === 'mediator' ? 'Mediator seat' : null,
                  invite.requiresApproval ? 'needs approval' : null,
                  invite.grantCount > 0 ? `${invite.grantCount} handed over` : null,
                  humanUses(invite.usesRemaining),
                  humanExpiry(invite.expiresAt),
                  invite.redeemers.length > 0 ? `used by ${invite.redeemers.join(', ')}` : null,
                ]
                  .filter((segment) => segment !== null && segment !== '')
                  .join(' · ')}
              </Text>
            </span>
            <span className="flex items-center gap-2">
              <Badge surface="tone" tone={STATUS_TONE[invite.status]}>
                {invite.status}
              </Badge>
              {invite.status === 'active' && (
                <Button
                  variant="ghost"
                  size="mini"
                  onClick={() => void revoke({ inviteId: invite._id })}
                >
                  Revoke
                </Button>
              )}
            </span>
          </div>
        ))}
        <Text variant="hint" className="text-left">
          Revoking closes a code. It never removes anyone who has already joined.
        </Text>
      </div>
    </div>
  )
}
