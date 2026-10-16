import type { CSSProperties } from 'react'
import { Fragment } from 'react'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from './interaction'

/**
 * BreadcrumbTrail — a page's trail: its ancestors as links, `//` between them,
 * the current page in bold. The caller wraps it in its
 * `nav aria-label="Breadcrumb"` and places it: the Union bar's own
 * (`AppBar`, in the bar or on a row under it) or a page's chapter band
 * (`ChapterBandTrail`). The `.su-crumbs*` classes dress each placement.
 *
 * `plate` is the band's form, a kicker on the title's cut-out: the ancestors
 * only, each followed by `//` (`SRD//CHASSIS//`), since the title under it
 * names the page. The current page stays in the list for a screen reader.
 */

export type BreadcrumbItem = {
  name: string
  url: string
}

const LIST = {
  alignItems: 'center',
  display: 'flex',
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const CRUMB_SEPARATOR = { userSelect: 'none' } satisfies CSSProperties

const SEPARATOR = (
  <li aria-hidden="true" className="su-crumbs__separator" style={CRUMB_SEPARATOR}>
    {'//'}
  </li>
)

export function BreadcrumbTrail({
  breadcrumbs,
  plate = false,
}: {
  breadcrumbs: BreadcrumbItem[]
  plate?: boolean
}) {
  if (plate) {
    const here = breadcrumbs.at(-1)
    return (
      <ol className="su-crumbs__list" style={LIST}>
        {breadcrumbs.slice(0, -1).map((item) => (
          <Fragment key={item.url}>
            <li className="su-crumbs__item">
              <a href={item.url} className={cn('su-crumbs__link', FOCUS_RING)}>
                {item.name}
              </a>
            </li>
            {SEPARATOR}
          </Fragment>
        ))}
        {here && (
          <li className="su-crumbs__item su-sr-only">
            <span aria-current="page">{here.name}</span>
          </li>
        )}
      </ol>
    )
  }
  return (
    <ol className="su-crumbs__list" style={LIST}>
      {breadcrumbs.map((item, index) => (
        <Fragment key={item.url}>
          {index > 0 && (
            <li aria-hidden="true" className="su-crumbs__separator" style={CRUMB_SEPARATOR}>
              {'//'}
            </li>
          )}
          <li className="su-crumbs__item">
            {index === breadcrumbs.length - 1 ? (
              <span aria-current="page" className="su-crumbs__here">
                {item.name}
              </span>
            ) : (
              <a href={item.url} className={cn('su-crumbs__link', FOCUS_RING)}>
                {item.name}
              </a>
            )}
          </li>
        </Fragment>
      ))}
    </ol>
  )
}
