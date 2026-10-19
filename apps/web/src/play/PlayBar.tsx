/**
 * PlayBar — the Cockpit's top bar: back to the Game's page, `ChevronLeft` and
 * "Game" (solo, "Play", back to the Play hub; ADR-052 §6), the
 * screen's title (the Game's name, or "Solo · <pilot>"), the role stamp
 * (the Mediator's screen says MEDIATOR), the LIVE stamp
 * while play reaches the server, then the Situation switch (On foot /
 * Boarded / Downtime, the `situation` slot), and at the end the Discord
 * channel button and ⋯ (the `channel` and `menu` slots).
 *
 * Presentational: what goes in the slots is the screen's. Everything on the
 * line is one Size, Compact (ruleset §4.7), the bar's own height included:
 * the stamps (role, LIVE, read-only) keep the Compact rung's type and take
 * the line's height (`play/bar.css`), their text centred, so they stand as
 * tall as the buttons beside them.
 */

import type { CSSProperties, ReactNode } from 'react'
import { BackLabel, Badge, buttonVariants, tokens } from '../components/index'
import { AppLink } from '../components/shared/AppLink'
import type { PlayReadOnly } from './play.model'
import { liveLabel } from './play.model'

const BAR = {
  alignItems: 'center',
  background: 'var(--color-band-cream)',
  borderRadius: tokens.radius.card,
  display: 'flex',
  gap: tokens.space[12],
  minWidth: 0,
  padding: `${tokens.space[4]} ${tokens.space[12]}`,
} satisfies CSSProperties

/** The phone form's: flush across the top of the screen, on two lines (`BREAK`). */
const PHONE_BAR = {
  ...BAR,
  borderBottom: `${tokens.borderWidth.hairline} solid var(--color-ink-30)`,
  borderRadius: 0,
  columnGap: tokens.space[8],
  flexWrap: 'wrap',
  padding: `${tokens.space[4]} ${tokens.space[8]}`,
  rowGap: tokens.space[4],
} satisfies CSSProperties

const BACK = {
  alignItems: 'center',
  display: 'inline-flex',
  flexShrink: 0,
  gap: tokens.space[2],
  textDecoration: 'none',
} satisfies CSSProperties

const TITLE = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.readout,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsTight,
  lineHeight: 1,
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

/**
 * A bar stamp (role, LIVE, read-only): the ink plate, never rust (ruleset
 * §3.1). Its height is the line's (`.su-play-bar__stamp`, `play/bar.css`).
 */
const LIVE = { flexShrink: 0, whiteSpace: 'nowrap' } satisfies CSSProperties

const STAMP = 'su-play-bar__stamp'

const SLOT = {
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  gap: tokens.space[8],
} satisfies CSSProperties

/** The phone bar's line break: the title on the first line, the stamps and buttons on the second. */
const BREAK = { flexBasis: '100%', height: 0 } satisfies CSSProperties

/** Pushes the channel button and ⋯ to the bar's end. */
const SPACER = { flex: '1 1 0%' } satisfies CSSProperties

export type PlayBarProps = {
  /** The Game's name, or "Solo · <pilot>" (`playTitle`). */
  title: string
  /** Where back goes: the Game's page, or (solo) the Play hub. */
  backHref?: string
  /** The place back goes to, its name beside the chevron: "Game", or "Play" (the hub). */
  backLabel?: string
  /** Play reaches the server: the LIVE stamp shows. */
  live: boolean
  /** In a Game, how many seats are here (`hereCount`): the stamp reads "● Live · 4 here". */
  here?: number | null
  /** Of how many seats: the stamp reads "● Live · 3 of 4 here" (the Mediator's screen). */
  of?: number | null
  /** A stamp after the title naming the viewer's role: "Mediator". */
  stamp?: string
  /**
   * Why Play is read-only (`playReadOnly`): its stamp takes the LIVE stamp's
   * place, so the bar says so wherever the screen is read-only.
   */
  readOnly?: PlayReadOnly | null
  /** The Situation switch: On foot / Boarded / Downtime. */
  situation?: ReactNode
  /** The Discord channel button: where this screen's rolls post. */
  channel?: ReactNode
  /** The ⋯ menu. */
  menu?: ReactNode
  /**
   * The phone form's bar (play.md §11): flush across the top, on two lines
   * (back and the title, then the LIVE stamp and the buttons) rather than
   * squeezing the title. The Situation goes under the pinned vitals there,
   * not in the bar.
   */
  phone?: boolean
}

export function PlayBar({
  title,
  backHref = '/play/',
  backLabel = 'Play',
  live,
  here = null,
  of = null,
  stamp,
  readOnly = null,
  situation,
  channel,
  menu,
  phone = false,
}: PlayBarProps) {
  return (
    <header style={phone ? PHONE_BAR : BAR}>
      <AppLink
        href={backHref}
        className={buttonVariants({ surface: 'instrument', variant: 'ghost', size: 'compact' })}
        style={BACK}
      >
        <BackLabel to={backLabel} />
      </AppLink>
      <h1 style={TITLE}>{title}</h1>
      {stamp && (
        <Badge shape="stamp" size="compact" className={STAMP} style={LIVE}>
          {stamp}
        </Badge>
      )}
      {phone && <span style={BREAK} aria-hidden="true" />}
      {readOnly !== null ? (
        <Badge
          shape="stamp"
          size="compact"
          surface="inverse"
          className={STAMP}
          style={LIVE}
          role="status"
          title={readOnly.says}
        >
          {readOnly.stamp}
        </Badge>
      ) : (
        live && (
          <Badge shape="stamp" size="compact" className={STAMP} style={LIVE}>
            {liveLabel(here, of)}
          </Badge>
        )
      )}
      {situation && <div style={SLOT}>{situation}</div>}
      <span style={SPACER} />
      {channel}
      {menu}
    </header>
  )
}
