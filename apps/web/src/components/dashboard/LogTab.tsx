/**
 * LogTab — the display's Log tab: the Game's rolls and the Mediator's alerts
 * (ADR-038 §4).
 *
 * Rolls come from the Game's change log (`changeLog.rolls`): every Dashboard
 * roll by anyone at the table, and the Discord bot's. It replaces the roll
 * history the Tables view kept on one device, which nobody else could see and
 * a reload threw away. Alerts are `proposals.alerts`, newest first, the same
 * feed the bottom strip shows the latest of.
 *
 * Presentational: `useGameFeed` reads both and hands them in.
 */

import type { CSSProperties } from 'react'
import { space } from '../../design/tokens'
import { EmptyState, Eyebrow, FeedLine, FeedList, FeedTime } from '../index'
import type { AlertLine, RollLine } from './useGameFeed'

const SCROLL = {
  height: '100%',
  overflowY: 'auto',
  padding: space[12],
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
} satisfies CSSProperties

const HEADING = { margin: `0 0 ${space[6]}` } satisfies CSSProperties

const SOURCE: Record<string, string> = { dashboard: 'Dashboard', 'discord-bot': 'Discord' }

export function LogTab({ rolls, alerts }: { rolls: RollLine[] | null; alerts: AlertLine[] }) {
  return (
    <div style={SCROLL}>
      {alerts.length > 0 ? (
        <section aria-labelledby="dash-log-alerts">
          <Eyebrow as="h3" tone="muted" id="dash-log-alerts" style={HEADING}>
            From the Mediator
          </Eyebrow>
          <FeedList>
            {alerts.map((a) => (
              <FeedLine key={a._id} head={<FeedTime ts={a.ts} format="clock" />}>
                {a.message}
              </FeedLine>
            ))}
          </FeedList>
        </section>
      ) : null}

      <section aria-labelledby="dash-log-rolls">
        <Eyebrow as="h3" tone="muted" id="dash-log-rolls" style={HEADING}>
          Rolls
        </Eyebrow>
        {rolls === null ? (
          <EmptyState variant="inline" body="The Game's rolls appear here." />
        ) : rolls.length === 0 ? (
          <EmptyState variant="quiet" body="No rolls yet. Every roll at this table lands here." />
        ) : (
          <FeedList>
            {rolls.map((r) => (
              <FeedLine
                key={r._id}
                head={
                  <span>
                    <FeedTime ts={r.ts} format="clock" />
                    {[r.actorName, SOURCE[r.source] ?? r.source]
                      .filter((part) => part !== null)
                      .map((part) => ` · ${part}`)
                      .join('')}
                  </span>
                }
              >
                {r.description}
              </FeedLine>
            ))}
          </FeedList>
        )}
      </section>
    </div>
  )
}
