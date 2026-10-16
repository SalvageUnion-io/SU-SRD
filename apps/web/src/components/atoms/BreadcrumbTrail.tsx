import type { CSSProperties } from 'react'
import { Fragment } from 'react'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from './interaction'

/**
 * BreadcrumbTrail — a page's trail: its ancestors as links, `//` between them,
 * the current page in bold, then an optional description. The caller wraps it
 * in its `nav aria-label="Breadcrumb"` and places it: the Union bar's own
 * (`AppBar`, in the bar or on a row under it) or a page's chapter band
 * (`ChapterBandTrail`). The `.su-crumbs*` classes dress each placement.
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

const CRUMB_DESCRIPTION = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

export function BreadcrumbTrail({
  breadcrumbs,
  description,
}: {
  breadcrumbs: BreadcrumbItem[]
  description?: string
}) {
  return (
    <>
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
      {description && (
        <span className="su-crumbs__description" style={CRUMB_DESCRIPTION} title={description}>
          — {description}
        </span>
      )}
    </>
  )
}
