/**
 * LastSession — "Last time at the table" on a Game's own page (play.md §16):
 * what the table did when it last played, with times, read off the table's
 * event stream (`lastSession.model.ts`), whether or not a group session was
 * started for it. While one runs it reads "This session". Its Mediator is
 * also told when an encounter is still running (MD4-04). Nothing until the
 * Game has been played.
 */

import { useState } from 'react'
import { FeedLine, FeedList, FeedTime } from '../../components/app'
import { Button, SlabSection, Text } from '../../components/index'
import { formatDateTime } from '../../lib/formatDate'
import { playGamesCopy } from '../../messages/play-games'
import { useViewerId } from '../../replica/roomCalls'
import { useTableRead } from '../../replica/useTable'
import { tableLine } from '../feed.model'
import { HUB_BODY } from './hubStyles.model'
import { lastSession } from './lastSession.model'

/** How many lines show before "Show all". */
const SHOWN = 12

export function LastSession({ gameId }: { gameId: string }) {
  const events = useTableRead('changeLog.events', { gameId })
  // The Mediator's alone: nobody else is served it, so nobody else is told.
  const running = useTableRead('mediator.running', { gameId }) ?? null
  const viewerId = useViewerId()
  const [all, setAll] = useState(false)
  const record = events === undefined ? null : lastSession(events)
  if (record === null && running === null) return null
  const stillRunning = running !== null && (
    <Text variant="note">{playGamesCopy('encounterStillRunning', { name: running.name })}</Text>
  )
  if (record === null) {
    return (
      <SlabSection
        as="h2"
        bodyStyle={HUB_BODY}
        id="last-session-heading"
        title={playGamesCopy('lastSession')}
      >
        {stillRunning}
      </SlabSection>
    )
  }
  const lines = all ? record.lines : record.lines.slice(0, SHOWN)
  return (
    <SlabSection
      as="h2"
      bodyStyle={HUB_BODY}
      id="last-session-heading"
      title={record.endedAt === null ? playGamesCopy('thisSession') : playGamesCopy('lastSession')}
    >
      {stillRunning}
      <Text variant="note">
        {record.endedAt === null
          ? playGamesCopy('sessionSince', { start: formatDateTime(record.startedAt) })
          : playGamesCopy('sessionFromTo', {
              start: formatDateTime(record.startedAt),
              end: formatDateTime(record.endedAt),
            })}
        {playGamesCopy('sessionCounts', { rolls: record.rolls, changes: record.changes })}
        {record.privateRolls > 0 &&
          playGamesCopy('sessionPrivateRolls', { count: record.privateRolls })}
      </Text>
      {lines.length > 0 && (
        <FeedList label={playGamesCopy('lastSession')}>
          {lines.map((line) => (
            <FeedLine key={line._id} end={<FeedTime ts={line.ts} format="clock" />}>
              {tableLine(line, viewerId)}
            </FeedLine>
          ))}
        </FeedList>
      )}
      {!all && record.lines.length > SHOWN && (
        <Button size="compact" onClick={() => setAll(true)}>
          {playGamesCopy('showAllLines', { count: record.lines.length })}
        </Button>
      )}
    </SlabSection>
  )
}
