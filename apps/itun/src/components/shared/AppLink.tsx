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
 * `href` takes a concrete pre-built path (e.g. `/sheet/mech/<id>` — slugs/
 * ids interpolated by the caller); TanStack resolves concrete paths at
 * runtime, so the static route-literal union on `to` is bypassed with a
 * narrowing assertion rather than threading params through every caller.
 */

import type { LinkProps } from '@tanstack/react-router'
import { Link, useRouter } from '@tanstack/react-router'
import type { AnchorHTMLAttributes } from 'react'
import { forwardRef } from 'react'

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
}

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink(
  { href, children, ...rest },
  ref
) {
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
})
