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
import { Checkbox, Field, Input, Text, Textarea, toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { playGamesCopy } from '../../messages/play-games'
import { useGamesCall } from '../../replica/roomCalls'
import { leavingOnPurpose } from '../tableNotices.model'
import { GameChannelRow } from './GameChannelRow'
import type { HeldByMember } from './leaving.model'

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

/**
 * Remove a member, or leave: `member` is who goes, null shuts the dialog.
 *
 * It names what goes home and what stays (`held`, LG4-03): the Game's own
 * pre-generated Pilots and Mechs stay on the roster, unassigned. Removing
 * someone offers to reset the invite link too, unticked as the words above it
 * say (LG4-04): the link is the whole table's, and resetting it strands
 * anyone who has not joined yet. The Organiser hears what happened; the
 * removed player is told by `TableNotices`.
 */
export function LeaveGameDialog({
  gameId,
  gameName,
  member,
  self,
  held,
  onClose,
  onLeft,
}: {
  gameId: string
  gameName: string
  member: { userId: string; name: string } | null
  /** What the member holds here: what goes back with them, and the Game's own, which stay. */
  held?: HeldByMember | undefined
  /** The viewer is the one going. */
  self: boolean
  onClose: () => void
  /** After the viewer has left: this Game is no longer theirs to see. */
  onLeft: () => void
}) {
  const remove = useGamesCall('games.removeMember', { gameId })
  const reset = useGamesCall('invites.reset')
  const [resetLink, setResetLink] = useState(false)
  const lists = (
    <>
      {held !== undefined && held.home.length > 0 && (
        <Text variant="hint">
          {playGamesCopy(self ? 'goesBackToYours' : 'goesBackToTheirs', {
            names: held.home.join(', '),
          })}
        </Text>
      )}
      {held !== undefined && held.staying.length > 0 && (
        <Text variant="hint">
          {playGamesCopy('staysUnassigned', { names: held.staying.join(', ') })}
        </Text>
      )}
    </>
  )
  return (
    <ConfirmDialog
      open={member !== null}
      onOpenChange={(next) => {
        if (!next) {
          onClose()
          setResetLink(false)
        }
      }}
      tone="danger"
      title={
        self
          ? playGamesCopy('leaveNamed', { name: gameName })
          : playGamesCopy('removeNamed', { name: member?.name ?? '' })
      }
      body={
        self ? (
          <>
            <Text>{playGamesCopy('leaveBody')}</Text>
            {lists}
          </>
        ) : (
          <>
            <Text>{playGamesCopy('removeBody')}</Text>
            {lists}
            {/* The words name the tick and toggle it (`Checkbox words`, R16). */}
            <Checkbox
              checked={resetLink}
              onChange={(e) => setResetLink(e.target.checked)}
              words={playGamesCopy('resetInviteLinkToo')}
            />
          </>
        )
      }
      confirmLabel={
        self ? playGamesCopy('leave') : playGamesCopy('removeWho', { name: member?.name ?? '' })
      }
      describeError={(err) => failureMessage(err, playGamesCopy('couldNotLeave'))}
      onConfirm={async () => {
        if (member === null) return
        if (self) {
          // Their own doing: `TableNotices` does not tell them of it.
          const undo = leavingOnPurpose(gameId)
          try {
            await remove({})
          } catch (err) {
            undo()
            throw err
          }
          onLeft()
          return
        }
        await remove({ userId: member.userId })
        if (!resetLink) {
          toast.success(playGamesCopy('removedFrom', { name: member.name, game: gameName }), {
            id: 'member-removed',
          })
          return
        }
        // The member is gone either way: a reset that fails says so, and Reset link is beside the roster.
        try {
          await reset({ gameId })
          toast.success(playGamesCopy('removedAndReset', { name: member.name, game: gameName }), {
            id: 'member-removed',
          })
        } catch {
          toast.warning(playGamesCopy('removedNotReset', { name: member.name, game: gameName }), {
            id: 'member-removed',
          })
        }
      }}
    />
  )
}
