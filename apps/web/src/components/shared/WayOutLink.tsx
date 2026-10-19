import type { CSSProperties } from 'react'
import { BackLabel, buttonVariants, tokens } from '../index'
import { AppLink } from './AppLink'

/** The 44px touch floor (ruleset §4.6), and no underline on a button-shaped link. */
const WAY_OUT = { minHeight: tokens.size.full, textDecoration: 'none' } satisfies CSSProperties

/**
 * The way off a page that cannot do what was asked (a dead invite link, a
 * Play screen with no pilot to run): a link drawn as a `Button`, so it reads as
 * the page's one way on and has a full touch target. Plain body text was easy
 * to miss and hard to hit. A way back says so as every back control does
 * (`BackLabel`): `ChevronLeft` and the place's name (`label`: "Hangar",
 * "Play", "Game"); a way on (`back={false}`, "Sign in with Discord") is its
 * words alone.
 */
export function WayOutLink({
  href,
  label,
  back = true,
}: {
  href: string
  label: string
  /** It goes back to a place (the default), or on to an act. */
  back?: boolean
}) {
  return (
    <AppLink
      href={href}
      className={buttonVariants({ variant: 'default', size: 'compact' })}
      style={WAY_OUT}
    >
      {back ? <BackLabel to={label} /> : label}
    </AppLink>
  )
}
