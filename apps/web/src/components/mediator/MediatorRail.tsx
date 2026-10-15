/**
 * MediatorRail — the Mediator Dashboard's top rail (board M1): the way back to
 * the Game page, the SU mark, a MEDIATOR stamp, the Game's name, how many
 * seats need attention, and whether the table is being saved
 * (`SavedIndicator`, the player rail's own).
 *
 * The attention count is a polite live region, so a seat going red is heard
 * without being shouted (docs/architecture/mediator-dashboard.md §7).
 * Presentational; the region wrapper is `DashboardGrid`'s `.su-dash-rail`.
 */

import { ChevronLeft } from 'lucide-react'
import type { CSSProperties } from 'react'
import { MARK_SRC } from '../../lib/documentHead'
import { SavedIndicator } from '../dashboard/SavedIndicator'
import { Badge, buttonVariants, tokens } from '../index'
import { AppLink } from '../shared/AppLink'

const { color, font, fontSize, space, tracking, weight } = tokens

const MARK = { display: 'block', flexShrink: 0 } satisfies CSSProperties

const NAME = {
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: font.cond,
  fontSize: fontSize.readout,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1,
  textTransform: 'uppercase',
} satisfies CSSProperties

const SPACER = { flex: 1 } satisfies CSSProperties

const COUNT = {
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.ink75,
  whiteSpace: 'nowrap',
  marginRight: space[8],
} satisfies CSSProperties

export function MediatorRail({
  gameId,
  gameName,
  summary,
}: {
  gameId: string
  gameName: string
  /** "5 seats · 2 need attention". */
  summary: string
}) {
  return (
    <>
      <AppLink
        href={`/games/${gameId}`}
        aria-label={`Back to ${gameName}`}
        className={buttonVariants({ surface: 'instrument', variant: 'ghost', size: 'iconOnly' })}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </AppLink>
      <img src={MARK_SRC} alt="" width={24} height={24} style={MARK} />
      <Badge shape="stamp" size="compact">
        Mediator
      </Badge>
      <h1 style={NAME}>{gameName}</h1>
      <span style={SPACER} />
      <span role="status" aria-live="polite" style={COUNT}>
        {summary}
      </span>
      <SavedIndicator />
    </>
  )
}
