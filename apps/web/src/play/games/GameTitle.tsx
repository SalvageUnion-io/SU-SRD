/**
 * GameTitle — the Game's name on its band (r6 C9, MD6-13), renamed in place by
 * its Organiser, right where the name is, so a first-time Mediator
 * never has to find "⋯ > Game settings… > edit > Save". The pencil beside the
 * name turns the title into its field; Enter or leaving the field saves, Escape keeps the old
 * name. Anyone else reads the name alone. Never cut (R56): it wraps.
 */

import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Button, Input, toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { playGamesCopy } from '../../messages/play-games'
import { useGamesCall } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'

/** The field in the title's place, at the title's type. */
const FIELD = {
  font: 'inherit',
  letterSpacing: 'inherit',
  maxWidth: '100%',
  textTransform: 'inherit',
  width: '100%',
} satisfies CSSProperties

/** The room's cap on a Game's name (`rooms/game/roster.ts`). */
const MAX_NAME = 80

export function GameTitle({
  gameId,
  name,
  editable,
}: {
  gameId: string
  name: string
  /** The viewer organises this Game: the name is theirs to change. */
  editable: boolean
}) {
  const { canWrite } = useSync()
  const update = useGamesCall('games.update', { gameId })
  const [draft, setDraft] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)
  const editing = draft !== null
  // The field opens with the name selected, so typing replaces it.
  useEffect(() => {
    if (editing) field.current?.select()
  }, [editing])

  if (!editable || !canWrite) return <>{name}</>
  if (draft === null) {
    return (
      <>
        {name}{' '}
        <Button
          variant="pencil"
          size="mini"
          aria-label={playGamesCopy('renameGame', { name })}
          onClick={() => setDraft(name)}
        >
          {playGamesCopy('rename')}
        </Button>
      </>
    )
  }
  const save = () => {
    const next = draft.trim()
    setDraft(null)
    if (next === '' || next === name) return
    update({ name: next }).catch((err: unknown) =>
      toast.error(failureMessage(err, playGamesCopy('renameNotSaved')))
    )
  }
  return (
    <Input
      ref={field}
      aria-label={playGamesCopy('gameNameField')}
      value={draft}
      maxLength={MAX_NAME}
      autoComplete="off"
      style={FIELD}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save()
        if (e.key === 'Escape') setDraft(null)
      }}
    />
  )
}
