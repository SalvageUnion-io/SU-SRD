/**
 * PlayBar — the Cockpit's top bar: back to the Game's page, `ChevronLeft` and
 * "Game" (solo, "Play", back to the Play hub; ADR-052 §6), the
 * screen's title (the Game's name, or the pilot's), the role stamp
 * (the Mediator's screen says MEDIATOR, a solo one SOLO), the LIVE stamp
 * while play reaches the server, then the Situation switch (On foot /
 * Boarded / Downtime, the `situation` slot), and at the end the Stop Sign
 * (in a Game), the Discord channel button and ⋯ (the `stop`, `channel` and
 * `menu` slots).
 *
 * The bar is the screen's chapter band, in its
 * phase's colour (`tone`, `PHASE_TONE`: on foot the pilot's orange, Boarded
 * the mech's green, Downtime the Cantina's pink), speckled, with the title
 * notched into its foot on a cut-out of the page ground, in ink. Its
 * foreground is whichever of ink and paper prints on the band (ruleset
 * §3.8); a band that prints paper is an ink ground (`data-ground`, chrome
 * K1), so the outlined buttons on it draw in paper. The colour crossfades
 * between phases (`.su-play-band`, `play/bar.css`). On a phone the title
 * takes its own line under the controls, so its cut-out still sits on the
 * band's foot.
 *
 * Presentational: what goes in the slots is the screen's. Everything on the
 * line is one Size, Compact (ruleset §4.7): the stamps (role, LIVE,
 * read-only) keep the Compact rung's type and take the line's height
 * (`play/bar.css`), their text centred, so they stand as tall as the buttons
 * beside them.
 */

import type { CSSProperties, ReactNode } from 'react'
import { capsLabel } from '../components/atoms/capsLabel'
import type { ChapterTone } from '../components/atoms/chapterBandColor'
import { Speckle } from '../components/atoms/Speckle'
import { Badge, Button, tokens } from '../components/index'
import { cn } from '../lib/cn'
import type { PlayReadOnly } from './play.model'
import { liveLabel, phaseBand } from './play.model'

/**
 * The band: its controls on one line, the title's cut-out flush with its
 * foot (`play/bar.css` lifts every other item off the foot by the band's
 * padding, so the line keeps one centre).
 */
const BAR = {
  alignItems: 'flex-end',
  display: 'flex',
  gap: tokens.space[12],
  isolation: 'isolate',
  minWidth: 0,
  padding: `${tokens.space[12]} ${tokens.space[12]} 0`,
  position: 'relative',
} satisfies CSSProperties

/** The phone form's: the controls on the first line, the title on its own under them (`BREAK`). */
const PHONE_BAR = {
  ...BAR,
  columnGap: tokens.space[8],
  flexWrap: 'wrap',
  padding: `${tokens.space[8]} ${tokens.space[8]} 0`,
  rowGap: tokens.space[4],
} satisfies CSSProperties

const BACK = {
  alignItems: 'center',
  display: 'inline-flex',
  flexShrink: 0,
  gap: tokens.space[2],
} satisfies CSSProperties

/**
 * The notch: the title on a cut-out of the page ground, in ink, flush with
 * the band's foot, as `ChapterBand`'s title sits on a page's band. Its line
 * is the controls' line (`.su-play-bar__notch`, `play/bar.css`), so the
 * title's text centres with the chips and buttons beside it.
 */
const TITLE = {
  background: 'var(--color-wk-bg)',
  color: 'var(--color-ink)',
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties
const TITLE_CAPS = capsLabel({ size: 'readout' })

/**
 * A bar stamp (role, LIVE, read-only): the ink plate, never rust (ruleset
 * §3.1). Its height is the line's (`.su-play-bar__stamp`, `play/bar.css`).
 */
const LIVE = { flexShrink: 0, whiteSpace: 'nowrap' } satisfies CSSProperties

const STAMP = 'su-play-bar__stamp'
const NOTCH = 'su-play-bar__notch'

const SLOT = {
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  gap: tokens.space[8],
} satisfies CSSProperties

/** The phone bar's line break: the controls on the first line, the title on the second. */
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
  /** The Stop Sign's button (`StopSignButton`), in a Game. */
  stop?: ReactNode
  /** The Discord channel button: where this screen's rolls post. */
  channel?: ReactNode
  /** The ⋯ menu. */
  menu?: ReactNode
  /**
   * The phone form's bar (play.md §11): flush across the top, on two lines
   * (back, the stamps and the buttons, then the title on its cut-out) rather
   * than squeezing the title. The Situation goes under the pinned vitals there,
   * not in the bar.
   */
  phone?: boolean
  /** The phase's band (`PHASE_TONE`); the Cantina's pink by default. */
  tone?: ChapterTone
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
  stop,
  channel,
  menu,
  phone = false,
  tone = 'play',
}: PlayBarProps) {
  const band = phaseBand(tone)
  const heading = (
    <h1 className={cn(NOTCH, TITLE_CAPS)} style={TITLE}>
      {title}
    </h1>
  )
  return (
    <header
      data-ground={band.ground}
      className="su-play-bar su-play-band"
      style={{ ...(phone ? PHONE_BAR : BAR), ...band.style }}
    >
      <Speckle grain="ink" />
      <Button href={backHref} back surface="instrument" variant="ghost" size="compact" style={BACK}>
        {backLabel}
      </Button>
      {!phone && heading}
      {stamp && (
        <Badge shape="stamp" size="compact" className={STAMP} style={LIVE}>
          {stamp}
        </Badge>
      )}
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
      {stop}
      {channel}
      {menu}
      {phone && (
        <>
          <span style={BREAK} aria-hidden="true" />
          {heading}
        </>
      )}
    </header>
  )
}
