/**
 * LastSession — "Last session" on a Game's own page (play.md §16): what the
 * table did in its newest group session, with times, read off the table's
 * event stream (`lastSession.model.ts`). While one runs it reads "This
 * session". Nothing until the Game has had one.
 */

import { useState } from 'react'
import { FeedLine, FeedList, FeedTime } from '../../components/app'
import { Button, SlabSection, Text } from '../../components/index'
import { formatDateTime } from '../../lib/formatDate'
import { playGamesCopy } from '../../messages/play-games'
import { useTableRead } from '../../replica/useTable'
import { HUB_BODY } from './hubStyles.model'
import { lastSession } from './lastSession.model'

/** How many lines show before "Show all". */
const SHOWN = 12

export function LastSession({ gameId }: { gameId: string }) {
  const events = useTableRead('changeLog.events', { gameId })
  const [all, setAll] = useState(false)
  const record = events === undefined ? null : lastSession(events)
  if (record === null) return null
  const lines = all ? record.lines : record.lines.slice(0, SHOWN)
  return (
    <SlabSection
      as="h2"
      bodyStyle={HUB_BODY}
      id="last-session-heading"
      title={record.endedAt === null ? playGamesCopy('thisSession') : playGamesCopy('lastSession')}
    >
      <Text variant="note">
        {record.endedAt === null
          ? playGamesCopy('sessionSince', { start: formatDateTime(record.startedAt) })
          : playGamesCopy('sessionFromTo', {
              start: formatDateTime(record.startedAt),
              end: formatDateTime(record.endedAt),
            })}
        {playGamesCopy('sessionCounts', { rolls: record.rolls, changes: record.changes })}
      </Text>
      {lines.length > 0 && (
        <FeedList label={playGamesCopy('lastSession')}>
          {lines.map((line) => (
            <FeedLine key={line._id} end={<FeedTime ts={line.ts} format="clock" />}>
              {line.text}
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
