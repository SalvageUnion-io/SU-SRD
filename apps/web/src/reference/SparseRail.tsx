// A sparse Page's side column (EDL form 5, the Page): who uses the entity and
// the rules that explain it. Its neighbours in its list are the Page's foot
// (`NeighbourRow`), as an ability's Preceding and Next are. It fills the room the
// Page's words leave and never more: the column is as tall as the main track
// (`pages.css`). Used by lists every user, kind and name, never a capped
// "and N more"; where the room runs out its rows scroll under a head that
// names the full count, and the short pieces after it stand whole. Every entry
// is a term (E27): a real link to its page on the SRD's surface, so the
// keyboard reaches it and it works with no script.
import type { CSSProperties } from 'react'
import { cn, Mention, TitledBox } from '../components/index'
import { ReferenceSurface } from '../components/ReferenceSurface'
import type { SideLinkList } from '../components/SideLinks'
import { SideLinks } from '../components/SideLinks'
import type { SparseRail as Rail } from '../lib/sparseRail'
import { referenceCopy } from '../messages/reference'

/** A chapter's tone as the colour token a TitledBox's band paints (`--color-<token>`). */
const BAND_TOKEN: Record<string, string> = {
  rules: 'wk-line',
  denizen: 'denizen-band',
  play: 'crawler-band',
  build: 'pilot',
}

/**
 * The rows Used by always shows (`pages-docs.css`, its 22rem floor): a longer
 * list grows to fit its rows however short the Page's words are, the Page
 * growing to hold them, and scrolls only past a screenful (Heat showed 14 of
 * 81 in a 22rem box beside an empty column, RR2-17).
 */
const USED_BY_FLOOR = 14

export function SparseRail({
  rail,
  tone: chapterTone,
  sideLinks,
}: {
  rail: Rail
  tone: string
  /** The tables the entry is rolled on, the rail's last piece. */
  sideLinks?: SideLinkList
}) {
  const { usedBy, rules } = rail
  const tone = BAND_TOKEN[chapterTone] ?? chapterTone
  const linked = (sideLinks?.rows.length ?? 0) > 0
  // An empty piece fills nothing: it is not drawn, and a rail with none is none.
  if (usedBy.length === 0 && rules.length === 0 && !linked) return null
  const pieces = [
    usedBy.length > 0 && (
      <TitledBox
        key="used-by"
        title={referenceCopy('usedBy')}
        titleAs="h2"
        tone={tone}
        className={cn('su-sparse-rail__piece', 'su-sparse-rail__used')}
        shrink
        bodyClassName={cn('su-sparse-rail__body', 'su-sparse-rail__used-body')}
      >
        {/* The count heads the rows and stays put: only the rows scroll. */}
        <p className="su-sparse-rail__count">
          {referenceCopy('usedByCount', { count: usedBy.length })}
        </p>
        <ul
          className={cn('su-sparse-rail__rows', 'su-sparse-rail__scroll')}
          // How many rows it would take to fit them all: the box grows to
          // that before it scrolls (`pages-docs.css`).
          style={{ '--su-used-rows': usedBy.length } as CSSProperties}
        >
          {usedBy.map((user) => (
            <li key={user.ref.id} className="su-sparse-rail__row">
              <Mention entityRef={user.ref} goes>
                {user.name}
              </Mention>
              <span className="su-sparse-rail__kind">{user.kind}</span>
            </li>
          ))}
        </ul>
      </TitledBox>
    ),
    rules.length > 0 && (
      <TitledBox
        key="rules"
        title={referenceCopy('relatedRules')}
        titleAs="h2"
        tone={tone}
        className="su-sparse-rail__piece"
        bodyClassName="su-sparse-rail__body"
      >
        <ul className="su-sparse-rail__list">
          {rules.map((rule) => (
            <li key={rule.ref.id}>
              <Mention entityRef={rule.ref} goes>
                {rule.name}
              </Mention>
            </li>
          ))}
        </ul>
      </TitledBox>
    ),
    linked && sideLinks && (
      <SideLinks key="side-links" list={sideLinks} className="su-sparse-rail__piece" />
    ),
  ].filter(Boolean)
  const [first, ...rest] = pieces
  return (
    <ReferenceSurface>
      <aside
        className={cn('su-sparse-rail', usedBy.length > USED_BY_FLOOR && 'su-sparse-rail--long')}
        aria-label={referenceCopy('relatedRules')}
        // Where else the entry is named is the screen's way on: paper prints the entry (RR6-08).
        data-print="hide"
      >
        {first}
        {rest.length > 0 && <div className="su-sparse-rail__rest">{rest}</div>}
      </aside>
    </ReferenceSurface>
  )
}
