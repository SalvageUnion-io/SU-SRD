/**
 * SheetRailParts — the rail's CTA button.
 *
 * `RailStatLine` lived here and is gone: the linked-unit slots render the
 * roster's `EntityRow` now, which takes flat `label | value` stat cells, so the
 * running-text join it existed to produce has no consumer. `rowStats`
 * (railStats.ts) is the adapter that replaced it.
 */

import { buttonVariants } from 'component-lib'

import { cn } from '../../lib/utils'
import { AppLink } from '../shared/AppLink'

/** Anchor CTA for rail empty slots ('+ Create'). */
export function RailCta({
  href,
  label,
  primary,
}: {
  href: string
  label: string
  primary?: boolean
}) {
  return (
    <AppLink
      href={href}
      className={cn(
        buttonVariants({ variant: primary ? 'primary' : 'default', size: 'compact' }),
        'no-underline'
      )}
    >
      {label}
    </AppLink>
  )
}
