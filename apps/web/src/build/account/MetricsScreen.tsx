import type { CSSProperties } from 'react'
import {
  ChapterBand,
  Cluster,
  EmptyState,
  PageShell,
  Pending,
  SlabSection,
  Stack,
  Stat,
  tokens,
} from '../../components/index'
import type { AdminMetrics as AdminMetricsRead } from '../../lib/account/accountApi'
import { useAdminMetrics } from '../../lib/account/accountApi'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { buildAccountCopy } from '../../messages/build-account'
import { useSync } from '../../replica/syncContext'

/**
 * The admin metrics page (ADR-057), at `/admin/metrics`: aggregate counts
 * only, for the accounts `ADMIN_DISCORD_IDS` names. Everybody else, signed in
 * or not, is told there is nothing here; the query itself answers them null.
 *
 * The totals are counted on every read; the weekly table is the live tallies,
 * newest week first.
 */

type Metrics = NonNullable<AdminMetricsRead>
type Counts = Metrics['totals']

/** The totals, in reading order, with the words each wears. */
const TOTALS: ReadonlyArray<[keyof Counts, string]> = [
  ['accounts', buildAccountCopy('accounts')],
  ['pilots', buildAccountCopy('pilots')],
  ['mechs', buildAccountCopy('mechs')],
  ['crawlers', buildAccountCopy('crawlers')],
  ['npcs', buildAccountCopy('npcs')],
  ['patterns', buildAccountCopy('patterns')],
  ['games', buildAccountCopy('games')],
  ['sharedGames', buildAccountCopy('gamesWithTwoOrMore')],
  ['botGuilds', buildAccountCopy('botServers')],
  ['botGuildsThisWeek', buildAccountCopy('botServersSevenDays')],
]

/** A tally key as a row label: `downtime:game` → "Downtime at a Game", `bot:su roll` → "/su roll". */
function tallyLabel(key: string): string {
  if (key === 'downtime:game') return buildAccountCopy('downtimeAtAGame')
  if (key === 'downtime:solo') return buildAccountCopy('downtimeSolo')
  if (key === 'session:game') return buildAccountCopy('groupSessionsStarted')
  if (key.startsWith('bot:')) return `/${key.slice(4)}`
  return key
}

const TABLE = {
  borderCollapse: 'collapse',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.body,
  width: '100%',
} satisfies CSSProperties

const CELL = {
  borderBottom: `${tokens.borderWidth.hairline} solid ${tokens.color.wkFaint}`,
  padding: `${tokens.space[4]} ${tokens.space[8]}`,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
} satisfies CSSProperties

const LABEL_CELL = { ...CELL, textAlign: 'left' } satisfies CSSProperties

const SCROLL = { overflowX: 'auto' } satisfies CSSProperties

function weekLabel(weekStart: number): string {
  return new Date(weekStart).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function WeeklyTable({ weeks }: { weeks: Metrics['weeks'] }) {
  if (weeks.length === 0) {
    return <EmptyState variant="quiet" body={buildAccountCopy('nothingTalliedYet')} />
  }
  const keys = [...new Set(weeks.flatMap((week) => Object.keys(week.counts)))].sort()
  return (
    <div style={SCROLL}>
      <table style={TABLE}>
        <thead>
          <tr>
            <th scope="col" style={LABEL_CELL}>
              {buildAccountCopy('weekOf')}
            </th>
            {weeks.map((week) => (
              <th key={week.weekStart} scope="col" style={CELL}>
                {weekLabel(week.weekStart)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key}>
              <th scope="row" style={LABEL_CELL}>
                {tallyLabel(key)}
              </th>
              {weeks.map((week) => (
                <td key={week.weekStart} style={CELL}>
                  {week.counts[key] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AdminMetrics() {
  const metrics = useAdminMetrics()

  if (metrics === undefined) return <Pending label={buildAccountCopy('theMetrics')} />
  if (metrics === null)
    return <EmptyState variant="quiet" body={buildAccountCopy('thereIsNothingHereFor')} />

  const { totals, weeks } = metrics
  return (
    <Stack gap={32}>
      <SlabSection as="h2" id="metrics-totals" title={buildAccountCopy('totals')}>
        <Cluster gap={8}>
          {TOTALS.map(([key, label]) => (
            <Stat key={key} label={label} value={totals[key]} size="mini" />
          ))}
        </Cluster>
      </SlabSection>
      <SlabSection as="h2" id="metrics-weekly" title={buildAccountCopy('eachWeek')}>
        <WeeklyTable weeks={weeks} />
      </SlabSection>
    </Stack>
  )
}

function MetricsBody() {
  const { status } = useSync()
  if (status === 'live') return <AdminMetrics />
  return <EmptyState variant="quiet" body={buildAccountCopy('thereIsNothingHereFor')} />
}

export function MetricsScreen() {
  return (
    <PageShell
      measure={PAGE_MEASURE}
      stack={false}
      band={
        <ChapterBand tone="ink" measure={PAGE_MEASURE}>
          {buildAccountCopy('metrics')}
        </ChapterBand>
      }
    >
      <MetricsBody />
    </PageShell>
  )
}
