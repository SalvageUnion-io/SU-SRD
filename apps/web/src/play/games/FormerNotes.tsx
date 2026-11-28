/**
 * FormerNotes — "Your notes from when you ran it", on a Game's page (ADR-067
 * §4, MD4-17): a member who mediated this Game and handed the table over
 * still reads the Game notes and private session notes they wrote. They are
 * theirs alone (`plan.mine` serves nobody else's) and read-only here: they
 * are edited again from Prep once the table is theirs. Nothing shows for a
 * member who wrote none.
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button, Field, ModalShell, SlabSection, Text, tokens } from '../../components/index'
import { formatDay } from '../../lib/formatDate'
import { playGamesCopy } from '../../messages/play-games'
import { useGamesQuery } from '../../replica/roomCalls'
import { HUB_ACTIONS } from './hubStyles.model'

const NOTES = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  padding: tokens.space[20],
} satisfies CSSProperties

export function FormerNotes({ gameId }: { gameId: string }) {
  const mine = useGamesQuery('plan.mine', { gameId })
  const [open, setOpen] = useState(false)
  if (mine == null) return null
  return (
    <SlabSection as="h2" id="former-notes-heading" title={playGamesCopy('formerNotes')}>
      <Text variant="hint">{playGamesCopy('formerNotesLede')}</Text>
      <div style={HUB_ACTIONS}>
        <Button size="compact" onClick={() => setOpen(true)}>
          {playGamesCopy('readYourNotes')}
        </Button>
      </div>
      <ModalShell open={open} onOpenChange={setOpen} title={playGamesCopy('formerNotes')}>
        <div style={NOTES}>
          <Field label={playGamesCopy('gameNotes')} value={mine.notes} multiline />
          {mine.sessions.map((session, at) => (
            <Field
              // A read-only list in the order the room keeps: nothing reorders it.
              // biome-ignore lint/suspicious/noArrayIndexKey: a session's note has no id of its own here
              key={at}
              label={
                session.date === undefined
                  ? playGamesCopy('formerNoteUndated')
                  : playGamesCopy('formerNoteFor', { day: formatDay(session.date) })
              }
              value={session.note}
              multiline
            />
          ))}
        </div>
      </ModalShell>
    </SlabSection>
  )
}
