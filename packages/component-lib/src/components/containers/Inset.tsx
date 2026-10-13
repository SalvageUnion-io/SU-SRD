import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import { Badge } from '../atoms/Badge'
import { Card } from './Card'

/** Ontological tone for the head-bar tag (pilot orange / mech green / crawler pink). */
type InsetTone = 'pilot' | 'mech' | 'crawler'

type InsetProps = {
  /** Head-bar title — condensed caps, paper on the ink bar. */
  label: ReactNode
  /** Colours the head-bar tag; omit for a paper (untoned) tag. */
  tone?: InsetTone
  /** Short keyword stamped at the head-bar's left edge, e.g. 'CREW'. */
  tag?: string
  /** Right-edge head-bar slot — a subtitle, meta readout, or actions. */
  headRight?: ReactNode
  /** Extra classes on the padded body wrapper (e.g. a flex layout). */
  bodyClassName?: string
  /** Inline style on the padded body wrapper — `bodyClassName`'s style-object twin. */
  bodyStyle?: CSSProperties
  children: ReactNode
}

const HEAD = {
  display: 'flex',
  width: '100%',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[8],
} satisfies CSSProperties

const TITLE = {
  minWidth: 0,
  fontFamily: font.cond,
  fontSize: fontSize.lede,
  fontWeight: weight.bold,
  textTransform: 'uppercase',
  lineHeight: 1,
  letterSpacing: tracking.capsTight,
  color: color.paper,
} satisfies CSSProperties

const HEAD_RIGHT = {
  marginLeft: 'auto',
  display: 'flex',
  flexShrink: 0,
  alignItems: 'center',
  gap: space[6],
} satisfies CSSProperties

const FRAME = { style: { backgroundColor: color.paper } }

/**
 * Inset — a boxed sub-panel meant to sit inside a parent card's expand slot
 * (the frame `NpcInset`'s crew-lead card and `CrawlerEconFrame`'s economy
 * panel compose).
 *
 * Anatomy: a chrome-weight ink frame on paper, an ink head bar carrying an
 * optional tone tag + a title (+ an optional right-edge subtitle/actions slot),
 * over a padded body (`children`). It is the closed, self-contained counterpart
 * to `Slab`'s open in-flow section leader — use Inset when an expanded entity
 * needs a bordered tracked-detail card, not a page-flow section.
 *
 * It is `Card`, configured — NOT a second frame implementation (ruleset §0: one
 * kind × one context = one primitive). A container with a header band over a
 * body band IS Card; the head bar is Card's header at the `small` density rung,
 * materialised ink (`headerBgColor` ink, which also inks the frame), and drawn
 * at the nested `chrome` frame weight (Card's `frame`).
 *
 * What Inset still owns, and why it is not a bare `Card` call at each site: the
 * head-bar VOCABULARY. The tone tag / paper condensed-caps title / right-edge
 * slot triple is a fixed composition its consumers share, and inlining it would
 * duplicate that markup at every call site — the thing this file exists to
 * prevent.
 */
export function Inset({
  label,
  tone,
  tag,
  headRight,
  bodyClassName,
  bodyStyle,
  children,
}: InsetProps) {
  // An inset with nothing to say below its head bar is just the bar: no empty
  // padded strip under it (a read-state crew lead with every field blank).
  const hasBody = children !== null && children !== undefined && children !== false
  return (
    <Card
      size="small"
      frame="chrome"
      headerBgColor="var(--color-ink)"
      cardStyle={FRAME}
      bodyStyle={hasBody ? { padding: space[10] } : undefined}
      headerContent={
        <div style={HEAD}>
          {tag && (
            <Badge surface={tone ? 'tone' : 'ghost'} tone={tone}>
              {tag}
            </Badge>
          )}
          <span style={TITLE}>{label}</span>
          {headRight != null && <span style={HEAD_RIGHT}>{headRight}</span>}
        </div>
      }
    >
      {/* The body layout stays on its own element rather than merging into
          Card's body classes: Card's body is a `flex-col` stack, and merging a
          consumer's row layout (`flex flex-wrap items-start`) into it would
          leave `flex-col` standing — silently turning NpcInset's row into a
          column. Layering keeps every consumer's child layout exactly as it was. */}
      {hasBody && (
        <div className={bodyClassName} style={bodyStyle}>
          {children}
        </div>
      )}
    </Card>
  )
}
