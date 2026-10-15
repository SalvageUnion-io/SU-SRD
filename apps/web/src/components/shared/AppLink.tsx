/**
 * AppLink — TanStack Router <Link> with a plain-anchor fallback.
 *
 * Sheet surfaces (LiveSheet back link, rail chips, top-bar Edit, segment
 * switch) navigate client-side through the router in the app. Component
 * tests render these surfaces WITHOUT a RouterProvider, so AppLink probes
 * the router context (`useRouter({ warn: false })`) and degrades to a plain
 * `<a href>` when no router is mounted — same accessible markup, no thrown
 * context error.
 *
 * `href` takes a concrete pre-built route of the app (e.g. `/sheet/mech/<id>`
 * — slugs/ids interpolated by the caller), which the router puts under the
 * base; TanStack resolves concrete paths at runtime, so the static
 * route-literal union on `to` is bypassed with a narrowing assertion rather
 * than threading params through every caller. A link that may leave the app
 * (a reference page) is a `SiteLink`, or a plain anchor.
 */

import type { LinkProps } from '@tanstack/react-router'
import { Link, useRouter } from '@tanstack/react-router'
import type { ComponentPropsWithRef } from 'react'
import { routeInApp } from '../../lib/appBase'

type AppLinkProps = Omit<ComponentPropsWithRef<'a'>, 'href'> & {
  href: string
}

export function AppLink({ href, children, ref, ...rest }: AppLinkProps) {
  const router = useRouter({ warn: false })

  if (!router) {
    return (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    )
  }

  return (
    <Link ref={ref} to={href as LinkProps['to']} {...rest}>
      {children}
    </Link>
  )
}

/**
 * A link to any page of the site, by its path on the site: one under the
 * app's base routes in place through `AppLink`; any other (a reference page)
 * is a plain anchor, a document load.
 */
export function SiteLink({ href, ...rest }: AppLinkProps) {
  const query = href.search(/[?#]/)
  const path = query === -1 ? href : href.slice(0, query)
  const route = routeInApp(path)
  if (route === null) return <a href={href} {...rest} />
  return <AppLink href={`${route}${href.slice(path.length)}`} {...rest} />
}
