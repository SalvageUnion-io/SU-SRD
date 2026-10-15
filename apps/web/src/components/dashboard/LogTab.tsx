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
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../../design/tokens'
import { formatClock } from '../../lib/formatDate'
import { EmptyState } from '../index'
import type { AlertLine, RollLine } from './useGameFeed'

const SCROLL = {
  height: '100%',
  overflowY: 'auto',
  padding: space[12],
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
} satisfies CSSProperties

const HEADING = {
  margin: `0 0 ${space[6]}`,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  color: color.ink75,
} satisfies CSSProperties

const LIST = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[4],
} satisfies CSSProperties

const ROW = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  padding: `${space[4]} ${space[8]}`,
  border: `${borderWidth.chrome} solid ${color.ink20}`,
  borderRadius: radius.card,
} satisfies CSSProperties

const META = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  color: color.ink75,
} satisfies CSSProperties

const TEXT = {
  fontFamily: font.body,
  fontSize: fontSize.note,
  color: color.ink,
} satisfies CSSProperties

const NOTE = { ...TEXT, margin: 0, color: color.ink75 } satisfies CSSProperties

const SOURCE: Record<string, string> = { dashboard: 'Dashboard', 'discord-bot': 'Discord' }

export function LogTab({ rolls, alerts }: { rolls: RollLine[] | null; alerts: AlertLine[] }) {
  return (
    <div style={SCROLL}>
      {alerts.length > 0 ? (
        <section aria-labelledby="dash-log-alerts">
          <h3 id="dash-log-alerts" style={HEADING}>
            From the Mediator
          </h3>
          <ul style={LIST}>
            {alerts.map((a) => (
              <li key={a._id} style={ROW}>
                <span style={META}>{formatClock(a.ts)}</span>
                <span style={TEXT}>{a.message}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="dash-log-rolls">
        <h3 id="dash-log-rolls" style={HEADING}>
          Rolls
        </h3>
        {rolls === null ? (
          <p style={NOTE}>The Game's rolls appear here.</p>
        ) : rolls.length === 0 ? (
          <EmptyState variant="quiet" body="No rolls yet. Every roll at this table lands here." />
        ) : (
          <ul style={LIST}>
            {rolls.map((r) => (
              <li key={r._id} style={ROW}>
                <span style={META}>
                  {[formatClock(r.ts), r.actorName, SOURCE[r.source] ?? r.source]
                    .filter((part) => part !== null)
                    .join(' · ')}
                </span>
                <span style={TEXT}>{r.description}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
