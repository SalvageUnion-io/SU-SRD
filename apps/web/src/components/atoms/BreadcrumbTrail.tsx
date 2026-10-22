import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { Fragment } from 'react'
import { cn } from '../../lib/cn'
import { atomsCopy } from '../../messages/components-atoms'
import { capsLabel } from './capsLabel'
import { FOCUS_RING } from './interaction'

/** On a band the trail is 11px caps, snug (§4.2). */
const BAND_CAPS = capsLabel({ tracking: 'snug' })

/**
 * BreadcrumbTrail — a page's trail, the one breadcrumb (hard rule R16): its
 * ancestors as links, `//` between them, the current page in bold, inside the
 * `nav aria-label="Breadcrumb"` it owns. `placement` says where it sits and
 * dresses it (`.su-crumbs--<placement>`):
 *
 * - `bar` — in the Union bar (`AppBar`);
 * - `row` — the phone's row under the bar (`AppBar`);
 * - `band` — the kicker on a page band's title cut-out (`ChapterBandTrail`,
 *   provided by a layout or a page): the ancestors only, each followed by `//`
 *   (`REFERENCE//CHASSIS//`), since the title under it names the page. The
 *   current page stays in the list for a screen reader.
 *
 * `link` renders each ancestor: a plain anchor by default (a static page), the
 * app's router link (`AppLink`) inside the app.
 */

export type BreadcrumbItem = {
  name: string
  url: string
}

type LinkProps = { href: string; className?: string; children: ReactNode }

/** What `link` renders an ancestor with: an anchor's shape. */
export type BreadcrumbLink = ComponentType<LinkProps>

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

const LINK_CLASS = cn('su-crumbs__link', FOCUS_RING)

function Anchor({ href, className, children }: LinkProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  )
}

export function BreadcrumbTrail({
  breadcrumbs,
  placement,
  link: Link = Anchor,
}: {
  breadcrumbs: BreadcrumbItem[]
  placement: 'bar' | 'row' | 'band'
  link?: BreadcrumbLink
}) {
  return (
    <nav
      aria-label={atomsCopy('breadcrumb')}
      className={cn(`su-crumbs su-crumbs--${placement}`, placement === 'band' && BAND_CAPS)}
    >
      {placement === 'band' ? (
        <Plate breadcrumbs={breadcrumbs} Link={Link} />
      ) : (
        <ol className="su-crumbs__list" style={LIST}>
          {breadcrumbs.map((item, index) => (
            <Fragment key={item.url}>
              {index > 0 && SEPARATOR}
              <li className="su-crumbs__item">
                {index === breadcrumbs.length - 1 ? (
                  <span aria-current="page" className="su-crumbs__here">
                    {item.name}
                  </span>
                ) : (
                  <Link href={item.url} className={LINK_CLASS}>
                    {item.name}
                  </Link>
                )}
              </li>
            </Fragment>
          ))}
        </ol>
      )}
    </nav>
  )
}

/** The band's form: the ancestors, each followed by `//`; the page for a screen reader. */
function Plate({ breadcrumbs, Link }: { breadcrumbs: BreadcrumbItem[]; Link: BreadcrumbLink }) {
  const here = breadcrumbs.at(-1)
  return (
    <ol className="su-crumbs__list" style={LIST}>
      {breadcrumbs.slice(0, -1).map((item) => (
        <Fragment key={item.url}>
          <li className="su-crumbs__item">
            <Link href={item.url} className={LINK_CLASS}>
              {item.name}
            </Link>
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
