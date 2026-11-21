/**
 * The Rolls pane's "Discord channel" row (play.md §9): where this screen's
 * rolls post, or that no channel is bound and who can bind one, with the one
 * button that opens the dialog (`PlayChannelDialog`). Whoever may bind is
 * offered "Set up"; a player with nothing bound is told who connects one and
 * is shown no control that could only say no.
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import type { ChannelOwner, PlayBinding } from './channels.model'
import { channelState } from './channels.model'
import { PlayChannelDialog } from './PlayChannel'

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  justifyContent: 'space-between',
} satisfies CSSProperties

const TEXT = {
  color: tokens.color.ink,
  display: 'flex',
  flex: '1 1 12rem',
  flexDirection: 'column',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  minWidth: 0,
} satisfies CSSProperties

const LABEL = { color: tokens.color.ink75 } satisfies CSSProperties

type PlayChannelRowProps = {
  owner: ChannelOwner
  binding: PlayBinding | null
  mayBind: boolean
}

export function PlayChannelRow({ owner, binding, mayBind }: PlayChannelRowProps) {
  const [open, setOpen] = useState(false)
  const offered = binding !== null || mayBind
  return (
    <div style={ROW}>
      <div style={TEXT}>
        <span style={LABEL}>{playCopy('discordChannel')}</span>
        <span>{channelState(owner.kind === 'solo', binding, mayBind)}</span>
      </div>
      {offered && (
        <Button
          variant="ghost"
          size="compact"
          aria-label={
            binding === null ? playCopy('channelSetUpLabel') : playCopy('channelDetailsLabel')
          }
          onClick={() => setOpen(true)}
        >
          {binding === null ? playCopy('channelSetUp') : playCopy('channelDetails')}
        </Button>
      )}
      {offered && (
        <PlayChannelDialog
          open={open}
          onClose={() => setOpen(false)}
          owner={owner}
          binding={binding}
          mayBind={mayBind}
        />
      )}
    </div>
  )
}
