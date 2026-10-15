import { buttonVariants } from 'component-lib'
import type { CSSProperties } from 'react'
import { AppLink } from './AppLink'

/** The 44px touch floor (ruleset §4.6), and no underline on a button-shaped link. */
const WAY_OUT = { minHeight: '44px', textDecoration: 'none' } satisfies CSSProperties

/**
 * The way off a page that cannot do what was asked (a dead invite link, a
 * Dashboard with no Game to run): a link drawn as a `Button`, so it reads as
 * the page's one way on and has a full touch target. Plain body text was easy
 * to miss and hard to hit.
 */
export function WayOutLink({ href, label }: { href: string; label: string }) {
  return (
    <AppLink
      href={href}
      className={buttonVariants({ variant: 'default', size: 'compact' })}
      style={WAY_OUT}
    >
      {label}
    </AppLink>
  )
}
