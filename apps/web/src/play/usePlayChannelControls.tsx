/**
 * The Play bar's Discord channel controls (play.md §9): the bound channel's
 * button, the ⋯ row that stands for it while none is bound, and the dialog
 * both open (`PlayChannelDialog`).
 */

import type { ReactNode } from 'react'
import { useState } from 'react'
import type { HeaderMenuItem } from '../components/index'
import { Button } from '../components/index'
import { playCopy } from '../messages/play'
import type { ChannelOwner, PlayBinding } from './channels.model'
import { channelButtonLabel } from './channels.model'
import { PlayChannelDialog } from './PlayChannel'

type PlayChannelOptions = {
  owner: ChannelOwner
  /** undefined while unknown (loading, offline): nothing is offered yet. */
  binding: PlayBinding | null | undefined
  /** The viewer may bind this owner's channel (`mayBindChannel`; solo, always). */
  mayBind: boolean
  /** The phone bar's: a bound channel is "#" alone, its name still the button's name. */
  compact?: boolean
}

/**
 * The Play bar's channel controls: `button`, the bound channel by its name;
 * `row`, the ⋯ menu's "Discord channel" while none is bound and the viewer may
 * bind one; and `dialog`, which both open (render it once, beside the bar).
 */
export function usePlayChannelControls({
  owner,
  binding,
  mayBind,
  compact = false,
}: PlayChannelOptions): {
  button: ReactNode
  row: HeaderMenuItem | null
  dialog: ReactNode
} {
  const [open, setOpen] = useState(false)
  const label = channelButtonLabel(owner, binding)
  return {
    button:
      binding == null ? null : (
        <Button
          variant="ghost"
          size="compact"
          aria-label={playCopy('whereRollsPost', { replace: label.replace(/^# /, '') })}
          onClick={() => setOpen(true)}
        >
          {compact ? '#' : label}
        </Button>
      ),
    row:
      binding === null && mayBind
        ? {
            id: 'channel',
            label: playCopy('discordChannel'),
            hint: playCopy('noneBoundYet'),
            onSelect: () => setOpen(true),
          }
        : null,
    dialog:
      binding === undefined ? null : (
        <PlayChannelDialog
          open={open}
          onClose={() => setOpen(false)}
          owner={owner}
          binding={binding}
        />
      ),
  }
}
