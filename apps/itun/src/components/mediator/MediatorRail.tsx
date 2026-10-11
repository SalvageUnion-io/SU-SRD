/**
 * MediatorRail — the Mediator Dashboard's top rail (board M1): the way back to
 * the Game page, the SU mark, a MEDIATOR stamp, the Game's name, how many
 * seats need attention, and whether the table is being saved
 * (`SavedIndicator`, the player rail's own).
 *
 * The attention count is a polite live region, so a seat going red is heard
 * without being shouted (docs/architecture/mediator-dashboard.md §7).
 * Presentational; the region wrapper is `DashboardGrid`'s `.pc-rail`.
 */

import { Badge, buttonVariants, tokens } from 'component-lib'
import { ChevronLeft } from 'lucide-react'
import type { CSSProperties } from 'react'
import { SavedIndicator } from '../dashboard/SavedIndicator'
import { AppLink } from '../shared/AppLink'

const { color, font, fontSize, space, tracking, weight } = tokens

const MARK: CSSProperties = { display: 'block', flexShrink: 0 }

const NAME: CSSProperties = {
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
}

const SPACER: CSSProperties = { flex: 1 }

const COUNT: CSSProperties = {
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.ink75,
  whiteSpace: 'nowrap',
  marginRight: space[8],
}

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
      <img src="/logos/su-cargo-dark.svg" alt="" width={24} height={24} style={MARK} />
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
