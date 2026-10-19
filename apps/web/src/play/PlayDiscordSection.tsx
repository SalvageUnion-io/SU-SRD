/**
 * PlayDiscordSection — the Play landing's Discord shelf (play.md §9): each of
 * my Games with its bound channel (`channelBindings.mine`), by its name
 * (`#salvage-run`, then the Game's), and Change, or, dashed, "No channel yet"
 * and Connect; then my own channel for solo play.
 * Change and Connect open the channel dialog (`PlayChannelDialog`), which
 * explains `/su bind`: a channel is bound in Discord, not here.
 *
 * Disconnected, there is no server to ask, so the shelf says so.
 */

import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import { Shelf } from '../build/shelves/Shelf'
import { capsLabel } from '../components/atoms/capsLabel'
import { Button, Pending, tokens } from '../components/index'
import { useConnection } from '../lib/connection/connectionContext'
import type { ChannelRow, MyChannels } from './channels.model'
import { channelRows, channelTag } from './channels.model'
import { PlayChannelDialog } from './PlayChannel'

const ITEM = { listStyle: 'none', minWidth: 0 } satisfies CSSProperties

const NAME = {
  margin: 0,
} satisfies CSSProperties
const NAME_CAPS = capsLabel({ size: 'readout' })

const WHERE = {
  display: 'flex',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

const NOTE = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
} satisfies CSSProperties

export function PlayDiscordSection() {
  const { mode } = useConnection()
  const mine = useQuery(api.channelBindings.mine, mode === 'connected' ? {} : 'skip') as
    | MyChannels
    | undefined
  const [open, setOpen] = useState<ChannelRow | null>(null)
  const rows = mine === undefined ? [] : channelRows(mine)

  return (
    <>
      <Shelf
        title="Discord"
        id="play-discord"
        note="Where each Game’s rolls post. Bind a channel by running /su bind in it."
        isEmpty={rows.length === 0}
        empty={
          mode === 'connected' ? (
            <Pending label="your channels" />
          ) : (
            'Your channels list once the connection returns.'
          )
        }
      >
        {rows.map((row) => (
          <li key={row.key} style={ITEM}>
            <div className="su-play-discord-row" data-unbound={row.binding === null || undefined}>
              <span style={WHERE}>
                <h3 className={NAME_CAPS} style={NAME}>
                  {channelTag(row.binding) ?? row.name}
                </h3>
                <span style={NOTE}>
                  {row.binding === null
                    ? 'No channel yet'
                    : channelTag(row.binding) !== null
                      ? row.name
                      : row.owner.kind === 'solo'
                        ? '# My channel'
                        : '# Channel bound'}
                </span>
              </span>
              <Button
                variant="default"
                size="mini"
                aria-label={`${row.binding === null ? 'Connect' : 'Change'} the channel for ${row.name}`}
                onClick={() => setOpen(row)}
              >
                {row.binding === null ? 'Connect' : 'Change'}
              </Button>
            </div>
          </li>
        ))}
      </Shelf>
      {open !== null && (
        <PlayChannelDialog
          open
          onClose={() => setOpen(null)}
          owner={open.owner}
          binding={open.binding}
        />
      )}
    </>
  )
}
