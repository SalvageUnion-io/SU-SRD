// A sparse Page's side column (EDL form 5, the Page): who uses the entity, the
// rules that explain it, its neighbours in its list. Just enough to fill the
// room the Page's words leave: the column is as tall as the main track, and a
// piece that would not fit drops whole, the last first (`front.css`).
import { Mention, TitledBox } from '../components/index'
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
  if (usedBy.count === 0 && rules.length === 0 && !previous && !next) return null
  const pieces = [
    usedBy.count > 0 && (
      <TitledBox
        key="used-by"
        title={referenceCopy('usedBy')}
        titleAs="h2"
        tone={tone}
        className="su-sparse-rail__piece"
        bodyClassName="su-sparse-rail__body"
      >
        <ul className="su-sparse-rail__list">
          {usedBy.first.map((user) => (
            <li key={user.ref.id}>
              <Mention entityRef={user.ref}>{user.name}</Mention>
            </li>
          ))}
          {usedBy.count > usedBy.first.length && (
            <li className="su-sparse-rail__more">
              {referenceCopy('usedByMore', { count: usedBy.count - usedBy.first.length })}
            </li>
          )}
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
        bodyClassName="su-sparse-rail__body su-sparse-rail__steps"
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
