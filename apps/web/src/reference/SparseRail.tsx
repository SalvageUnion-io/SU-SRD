// A sparse Page's side column (EDL form 5, the Page): who uses the entity, the
// rules that explain it, its neighbours in its list. It fills the room the
// Page's words leave and never more: the column is as tall as the main track
// (`pages.css`). Used by lists every user, kind and name, never a capped
// "and N more"; where the room runs out its rows scroll under a head that
// names the full count, and the short pieces after it stand whole.
import { cn, Mention, TitledBox } from '../components/index'
import type { SparseRail as Rail } from '../lib/sparseRail'
import { referenceCopy } from '../messages/reference'

/** A chapter's tone as the colour token a TitledBox's band paints (`--color-<token>`). */
const BAND_TOKEN: Record<string, string> = {
  rules: 'wk-line',
  denizen: 'denizen-band',
  play: 'crawler-band',
  build: 'pilot',
}

export function SparseRail({ rail, tone: chapterTone }: { rail: Rail; tone: string }) {
  const { list, usedBy, rules, previous, next } = rail
  const tone = BAND_TOKEN[chapterTone] ?? chapterTone
  // An empty piece fills nothing: it is not drawn, and a rail with none is none.
  if (usedBy.length === 0 && rules.length === 0 && !previous && !next) return null
  const pieces = [
    usedBy.length > 0 && (
      <TitledBox
        key="used-by"
        title={referenceCopy('usedBy')}
        titleAs="h2"
        tone={tone}
        className={cn('su-sparse-rail__piece', 'su-sparse-rail__used')}
        shrink
        bodyClassName={cn('su-sparse-rail__body', 'su-sparse-rail__scroll')}
      >
        <p className="su-sparse-rail__count">
          {referenceCopy('usedByCount', { count: usedBy.length })}
        </p>
        <ul className="su-sparse-rail__rows">
          {usedBy.map((user) => (
            <li key={user.ref.id} className="su-sparse-rail__row">
              <Mention entityRef={user.ref}>{user.name}</Mention>
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
              <Mention entityRef={rule.ref}>{rule.name}</Mention>
            </li>
          ))}
        </ul>
      </TitledBox>
    ),
    (previous || next) && (
      <TitledBox
        key="list"
        title={list}
        titleAs="h2"
        tone={tone}
        className="su-sparse-rail__piece"
        bodyClassName={cn('su-sparse-rail__body', 'su-sparse-rail__steps')}
      >
        {previous && (
          <p>
            <span className="su-sparse-rail__step">{referenceCopy('previousEntry')}</span>{' '}
            <Mention entityRef={previous.ref}>{previous.name}</Mention>
          </p>
        )}
        {next && (
          <p>
            <span className="su-sparse-rail__step">{referenceCopy('nextEntry')}</span>{' '}
            <Mention entityRef={next.ref}>{next.name}</Mention>
          </p>
        )}
      </TitledBox>
    ),
  ].filter(Boolean)
  const [first, ...rest] = pieces
  return (
    <aside className="su-sparse-rail" aria-label={referenceCopy('relatedRules')}>
      {first}
      {rest.length > 0 && <div className="su-sparse-rail__rest">{rest}</div>}
    </aside>
  )
}
