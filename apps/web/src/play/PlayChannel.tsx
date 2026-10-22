/**
 * Play's Discord channel controls (play.md §9): the Play bar's channel button
 * and the dialog it, and the landing's Change / Connect, open.
 *
 * A channel is bound in Discord, not here: `/su bind` run in a channel binds
 * it to one of the caller's Games (the Mediator or the Organiser,
 * `mayBindChannel`), or with no Game to the caller's own solo play. So the
 * dialog explains that, and says what is bound now. The button names the
 * channel as it was when bound (`#salvage-run`), or by whose it is where the
 * binding kept no name (`channelButtonLabel`).
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button, Callout, ModalShell, tokens } from '../components/index'
import { formatDateTime } from '../lib/formatDate'
import type { ChannelOwner, PlayBinding } from './channels.model'
import { channelButtonLabel } from './channels.model'

const BODY = {
  color: tokens.color.ink,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  gap: tokens.space[8],
} satisfies CSSProperties

const P = { margin: 0 } satisfies CSSProperties

const CODE = { fontWeight: tokens.weight.bold, whiteSpace: 'nowrap' } satisfies CSSProperties

type PlayChannelDialogProps = {
  open: boolean
  onClose: () => void
  owner: ChannelOwner
  /** The bound channel, or null when none is. */
  binding: PlayBinding | null
}

function PlayChannelDialog({ open, onClose, owner, binding }: PlayChannelDialogProps) {
  const whose = owner.kind === 'solo' ? 'your solo play' : (owner.gameName ?? 'this Game')
  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={binding === null ? 'Connect a Discord channel' : 'Discord channel'}
      width="default"
    >
      <div style={BODY}>
        {binding === null ? (
          <p style={P}>No Discord channel is bound to {whose} yet, so its rolls stay in Play.</p>
        ) : (
          <p style={P}>
            Rolls from {whose} post to its bound Discord channel, as the bot’s roll card. Bound{' '}
            {formatDateTime(binding.boundAt)}.
          </p>
        )}
        <p style={P}>
          {binding === null ? 'To connect one, run ' : 'To move it, run '}
          <span style={CODE}>/su bind</span>
          {owner.kind === 'solo'
            ? ' in the Discord channel you want, without naming a Game.'
            : ' in the Discord channel you want, and pick this Game.'}{' '}
          {binding !== null && (
            <>
              <span style={CODE}>/su unbind</span> stops posting.
            </>
          )}
        </p>
        {owner.kind === 'game' && (
          <Callout>Only the Game’s Mediator or Organiser can bind its channel.</Callout>
        )}
      </div>
    </ModalShell>
  )
}

type PlayChannelButtonProps = {
  owner: ChannelOwner
  /** undefined while unknown (loading, offline): the button waits. */
  binding: PlayBinding | null | undefined
  /** The phone bar's: a bound channel is "#" alone, its name still the button's name. */
  compact?: boolean
}

/** The Play bar's channel button: the bound channel, or Connect. Opens the dialog. */
export function PlayChannelButton({ owner, binding, compact = false }: PlayChannelButtonProps) {
  const [open, setOpen] = useState(false)
  const label = channelButtonLabel(owner, binding)
  return (
    <>
      <Button
        variant="ghost"
        size="compact"
        disabled={binding === undefined}
        aria-label={
          binding == null
            ? 'Connect a Discord channel'
            : `${label.replace(/^# /, '')}: where rolls post`
        }
        onClick={() => setOpen(true)}
      >
        {compact && binding != null ? '#' : label}
      </Button>
      {binding !== undefined && (
        <PlayChannelDialog
          open={open}
          onClose={() => setOpen(false)}
          owner={owner}
          binding={binding}
        />
      )}
    </>
  )
}
