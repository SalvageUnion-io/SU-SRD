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
import { inlineCode } from '../lib/docPageStyles'
import { formatDateTime } from '../lib/formatDate'
import { playCopy } from '../messages/play'
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

const CODE = { ...inlineCode(), whiteSpace: 'nowrap' } satisfies CSSProperties

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
      title={binding === null ? playCopy('connectADiscordChannel') : playCopy('discordChannel')}
      width="default"
    >
      <div style={BODY}>
        {binding === null ? (
          <p style={P}>{playCopy('noDiscordChannelIsBound', { whose })}</p>
        ) : (
          <p style={P}>
            {playCopy('rollsFromPostToIts', { whose, dateTime: formatDateTime(binding.boundAt) })}
          </p>
        )}
        <p style={P}>
          {binding === null ? playCopy('toConnectOneRun') : playCopy('toMoveItRun')}
          <code style={CODE}>{playCopy('suBind')}</code>
          {owner.kind === 'solo'
            ? playCopy('inTheDiscordChannelYou')
            : playCopy('inTheDiscordChannelYou2')}{' '}
          {binding !== null && (
            <>
              <code style={CODE}>{playCopy('suUnbind')}</code> stops posting.
            </>
          )}
        </p>
        {owner.kind === 'game' && <Callout>{playCopy('onlyTheGamesMediatorOr')}</Callout>}
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
            ? playCopy('connectADiscordChannel')
            : playCopy('whereRollsPost', { replace: label.replace(/^# /, '') })
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
