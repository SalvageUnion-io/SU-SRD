/**
 * Play's Discord channel dialog (play.md §9), which the Play bar's channel
 * button and its ⋯ row open (`usePlayChannelControls`).
 *
 * Only someone who can bind is offered the way to: with nothing bound, the
 * ⋯'s "Discord channel" row, for a Game's Mediator or Organiser (or anyone,
 * solo) and nobody else, so a player is never shown a control that can only
 * say no. A bound channel is the bar's button for everyone, by its name.
 *
 * A channel is bound in Discord, not here: `/su bind` run in a channel binds
 * it to one of the caller's Games (the Mediator or the Organiser,
 * `mayBindChannel`), or with no Game to the caller's own solo play. So the
 * dialog explains that, and says what is bound now. The button names the
 * channel as it was when bound (`#salvage-run`), or by whose it is where the
 * binding kept no name (`channelButtonLabel`).
 */

import type { CSSProperties } from 'react'
import { Callout, ModalShell, tokens } from '../components/index'
import { inlineCode } from '../lib/docPageStyles'
import { formatDateTime } from '../lib/formatDate'
import { playCopy } from '../messages/play'
import type { ChannelOwner, PlayBinding } from './channels.model'

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

export function PlayChannelDialog({ open, onClose, owner, binding }: PlayChannelDialogProps) {
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
