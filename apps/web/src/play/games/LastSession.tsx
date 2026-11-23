/**
 * LastSession — "Last time at the table" on a Game's own page (play.md §16):
 * what the table did when it last played, with times, read off the table's
 * event stream (`lastSession.model.ts`), whether or not a group session was
 * started for it. While one runs it reads "This session". Its Mediator is
 * also told when an encounter is still running (MD4-04). Nothing until the
 * Game has been played.
 *
 * Once it has ended it is the session's recap (r6 C1, `sessionRecap.model.ts`),
 * the page's first section for everyone until the next one starts: what is
 * Still open (the proposals awaiting an answer) first, then the night (who
 * was hurt and who is Down, what was salvaged and where Scrap went, the
 * damage taken), then the last and next plans (r7 C10). The raw lines wait
 * under **Full log**.
 */

import { fieldLabel, proposalValueText } from 'game-domain/games/proposals'
import { useState } from 'react'
import { FeedLine, FeedList, FeedTime } from '../../components/app'
import { UnitDown } from '../../components/entity/UnitDown'
import { Button, SlabSection, Text } from '../../components/index'
import { formatDateTime, todayDay } from '../../lib/formatDate'
import { playGamesCopy } from '../../messages/play-games'
import { useViewerId } from '../../replica/roomCalls'
import { useTableRead } from '../../replica/useTable'
import { tableLine } from '../feed.model'
import { HUB_BODY } from './hubStyles.model'
import { lastSession } from './lastSession.model'
import { sessionRecap } from './sessionRecap.model'
import type { PlansFor } from './useNextSession'

/** A proposal as the recap's Still open lists it: "Pickle · HP → 7". */
const openLine = (p: { targetName: string | null; field: string; after: unknown }) =>
  `${p.targetName ?? playGamesCopy('aSheet')} · ${fieldLabel(p.field)} → ${proposalValueText(p.after)}`

/** How many lines show before "Show all". */
const SHOWN = 12

export function LastSession({
  gameId,
  plans,
  place,
}: {
  gameId: string
  /**
   * Where the page stands it (r6 C1): `lead`, its first section, holds an
   * ended session's recap; `after`, under the Crew, the one still running.
   * Each draws nothing when the other is the one to show.
   */
  place: 'lead' | 'after'
  /** The last and next plans as the viewer may read them, given the day the table last played. */
  plans?: PlansFor
}) {
  const events = useTableRead('changeLog.events', { gameId })
  // What is still open: proposals awaiting an answer, the viewer's and the ones they sent.
  const waiting = useTableRead('ops.pending', place === 'lead' ? { gameId } : 'skip')
  const sent = useTableRead('ops.sent', place === 'lead' ? { gameId } : 'skip')
  const [log, setLog] = useState(false)
  // The Mediator's alone: nobody else is served it, so nobody else is told.
  const running = useTableRead('mediator.running', { gameId }) ?? null
  const viewerId = useViewerId()
  const [all, setAll] = useState(false)
  const record = events === undefined ? null : lastSession(events)
  if (record === null && running === null) return null
  const leads = record !== null && record.endedAt !== null
  if ((place === 'lead') !== leads) return null
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
  const ended = record.endedAt !== null
  const recap = ended ? sessionRecap(record.lines) : null
  // Still open leads the recap (r7 C10, MD7-09): every proposal not yet answered.
  const stillOpen = ended
    ? [
        ...(waiting ?? []).map(openLine),
        ...(sent ?? []).filter((p) => p.state === 'proposed').map(openLine),
      ].filter((line, i, all) => all.indexOf(line) === i)
    : []
  const planned =
    ended && plans !== undefined && record.endedAt !== null
      ? plans(todayDay(new Date(record.endedAt)))
      : { next: null, last: null }
  // Ended, the lines are the recap's Full log; while it runs, they are the session.
  const showLines = !ended || log
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
      {ended && stillOpen.length > 0 && (
        <FeedList label={playGamesCopy('recapStillOpen')}>
          {stillOpen.map((line) => (
            <FeedLine key={line} head={playGamesCopy('recapStillOpen')}>
              {line}
            </FeedLine>
          ))}
        </FeedList>
      )}
      {recap !== null && recap.hurt.length > 0 && (
        <FeedList label={playGamesCopy('recapHurt')}>
          {recap.hurt.map((v) => (
            <FeedLine
              key={`${v.who}:${v.label}`}
              end={
                v.down ? (
                  <UnitDown readings={[{ label: v.label, value: `0/${v.from}` }]} />
                ) : undefined
              }
            >
              {playGamesCopy('recapVital', { ...v, from: String(v.from), to: String(v.to) })}
            </FeedLine>
          ))}
        </FeedList>
      )}
      {recap !== null && recap.moved.length > 0 && (
        <FeedList label={playGamesCopy('recapMoved')}>
          {recap.moved.map((line) => (
            <FeedLine key={line} head={playGamesCopy('recapMoved')}>
              {line}
            </FeedLine>
          ))}
        </FeedList>
      )}
      {recap !== null && recap.damageTaken.length > 0 && (
        <FeedList label={playGamesCopy('recapDamageTaken')}>
          {recap.damageTaken.map((line) => (
            <FeedLine key={line} head={playGamesCopy('recapDamageTaken')}>
              {line}
            </FeedLine>
          ))}
        </FeedList>
      )}
      {recap?.downtime && <Text variant="note">{playGamesCopy('recapDowntime')}</Text>}
      {ended && planned.last !== null && (
        <Text variant="note">{playGamesCopy('recapLast', { last: planned.last })}</Text>
      )}
      {ended && planned.next !== null && (
        <Text variant="note">{playGamesCopy('recapNext', { next: planned.next })}</Text>
      )}
      {ended && record.lines.length > 0 && (
        <div>
          <Button size="compact" aria-expanded={log} onClick={() => setLog((open) => !open)}>
            {playGamesCopy('fullLog')}
          </Button>
        </div>
      )}
      {showLines && lines.length > 0 && (
        <FeedList label={playGamesCopy('lastSession')}>
          {lines.map((line) => (
            <FeedLine key={line._id} end={<FeedTime ts={line.ts} format="clock" />}>
              {tableLine(line, viewerId)}
            </FeedLine>
          ))}
        </FeedList>
      )}
      {showLines && !all && record.lines.length > SHOWN && (
        <Button size="compact" onClick={() => setAll(true)}>
          {playGamesCopy('showAllLines', { count: record.lines.length })}
        </Button>
      )}
    </SlabSection>
  )
}
