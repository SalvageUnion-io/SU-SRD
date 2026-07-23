import type { ReactNode } from 'react'

import { Badge } from '../chrome/Badge'
import { Card } from './Card'

/** Ontological tone for the head-bar tag (pilot orange / mech green / crawler pink). */
export type InsetTone = 'pilot' | 'mech' | 'crawler'

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
  children: ReactNode
}

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
 * materialised ink (`headerBg="bg-ink"`, which also inks the frame), and drawn
 * at the nested `chrome` frame weight. That weight is the one thing Card could
 * not previously express — its border was hardcoded at 3px — so `frame` was
 * added to Card rather than keeping the hand-rolled `<section>` here.
 *
 * What Inset still owns, and why it is not a bare `Card` call at each site: the
 * head-bar VOCABULARY. The tone tag / paper condensed-caps title / right-edge
 * slot triple is a fixed composition its consumers share, and inlining it would
 * duplicate that markup at every call site — the thing this file exists to
 * prevent.
 */
export function Inset({ label, tone, tag, headRight, bodyClassName, children }: InsetProps) {
  return (
    <Card
      size="small"
      frame="chrome"
      headerBg="bg-ink"
      cardStyle={{ className: 'bg-paper' }}
      bodyPadding="p-2.5"
      headerContent={
        <div className="flex w-full flex-wrap items-center gap-2">
          {tag && (
            <Badge surface={tone ? 'tone' : 'ghost'} tone={tone}>
              {tag}
            </Badge>
          )}
          <span className="min-w-0 font-cond text-lede font-bold uppercase leading-none tracking-caps-tight text-paper">
            {label}
          </span>
          {headRight != null && (
            <span className="ml-auto flex shrink-0 items-center gap-1.5">{headRight}</span>
          )}
        </div>
      }
    >
      {/* The body layout stays on its own element rather than merging into
          Card's body classes: Card's body is a `flex-col` stack, and merging a
          consumer's row layout (`flex flex-wrap items-start`) into it would
          leave `flex-col` standing — silently turning NpcInset's row into a
          column. Layering keeps every consumer's child layout exactly as it was. */}
      <div className={bodyClassName}>{children}</div>
    </Card>
  )
}
