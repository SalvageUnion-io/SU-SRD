/**
 * A Game's settings and its roster's two ways out (ADR-067 §3), asked from
 * The Game (`TheGame`): Game settings (the Organiser renames it and says what
 * it is, which its invite then shows), Remove a member (the Organiser's) and
 * Leave (a member's own). Whoever goes, their pilots and mechs return to
 * their Training Bay first: nothing is deleted (ADR-007).
 */

import { GAME_MAX_DESCRIPTION } from 'game-domain/schemas/gamePlan'
import { useId, useRef, useState } from 'react'
import { ConfirmDialog } from '../../components/app'
import { Field, Input, Text, Textarea } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { playGamesCopy } from '../../messages/play-games'
import { useGamesCall } from '../../replica/roomCalls'
import { GameChannelRow } from './GameChannelRow'

/** Rename the Game and describe it. Its opener keys it, so each opening starts from what is kept. */
export function GameSettingsDialog({
  gameId,
  name,
  description,
  open,
  onOpenChange,
}: {
  gameId: string
  name: string
  description: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const id = useId()
  const field = useRef<HTMLInputElement>(null)
  const update = useGamesCall('games.update', { gameId })
  const [draft, setDraft] = useState({ name, description: description ?? '' })
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={playGamesCopy('gameSettings')}
      initialFocus={field}
      body={
        <>
          <Field label={playGamesCopy('gameName')} htmlFor={`${id}-name`}>
            <Input
              ref={field}
              id={`${id}-name`}
              value={draft.name}
              autoComplete="off"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label={playGamesCopy('gameDescription')} htmlFor={`${id}-description`}>
            <Textarea
              id={`${id}-description`}
              value={draft.description}
              rows={3}
              maxLength={GAME_MAX_DESCRIPTION}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </Field>
          <Text variant="hint">{playGamesCopy('gameDescriptionHint')}</Text>
          {/* The Organiser may bind the Game's channel: offered here too (MD-20). */}
          <GameChannelRow gameId={gameId} gameName={name} mayBind />
        </>
      }
      confirmLabel={playGamesCopy('saveSettings')}
      describeError={(err) => failureMessage(err, playGamesCopy('settingsNotSaved'))}
      onConfirm={async () => {
        await update(draft)
      }}
    />
  )
}

/** Remove a member, or leave: `member` is who goes, null shuts the dialog. */
export function LeaveGameDialog({
  gameId,
  gameName,
  member,
  self,
  onClose,
  onLeft,
}: {
  gameId: string
  gameName: string
  member: { userId: string; name: string } | null
  /** The viewer is the one going. */
  self: boolean
  onClose: () => void
  /** After the viewer has left: this Game is no longer theirs to see. */
  onLeft: () => void
}) {
  const remove = useGamesCall('games.removeMember', { gameId })
  return (
    <ConfirmDialog
      open={member !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      tone="danger"
      title={
        self
          ? playGamesCopy('leaveNamed', { name: gameName })
          : playGamesCopy('removeNamed', { name: member?.name ?? '' })
      }
      body={self ? playGamesCopy('leaveBody') : playGamesCopy('removeBody')}
      confirmLabel={self ? playGamesCopy('leave') : playGamesCopy('remove')}
      describeError={(err) => failureMessage(err, playGamesCopy('couldNotLeave'))}
      onConfirm={async () => {
        if (member === null) return
        await remove(self ? {} : { userId: member.userId })
        if (self) onLeft()
      }}
    />
  )
}
