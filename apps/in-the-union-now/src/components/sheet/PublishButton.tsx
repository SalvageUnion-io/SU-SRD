/**
 * PublishButton — the sheet top-bar 'Share' entry point.
 *
 * Since the Share Snapshot screen landed (design §3.4, plan 5.2) this no
 * longer publishes inline: it navigates to `/sheet/:kind/:id/share`, where
 * the preview, the Publish primary (with S6 feature-detection), the copyable
 * anonymous link and the QR/print affordances live. The component name and
 * prop surface are kept so Sheet.tsx and existing call sites don't churn.
 */

import { buttonVariants } from 'component-lib'

import type { EntityRef } from '../../lib/schemas/entity'
import { cn } from '../../lib/utils'
import { AppLink } from '../shared/AppLink'
import type { EntityLookup } from './composition'

type PublishButtonProps = {
  entityKind: EntityRef['type']
  entityId: string
  /** Accepted for call-site compatibility (Sheet passes it); unused here. */
  entityStore?: EntityLookup
}

export function PublishButton({ entityKind, entityId }: PublishButtonProps) {
  return (
    <AppLink
      href={`/sheet/${entityKind}/${entityId}/share`}
      aria-label={`Share this ${entityKind} as a snapshot`}
      className={cn(buttonVariants({ size: 'sm' }), 'min-h-11 no-underline sm:min-h-9')}
    >
      Share
    </AppLink>
  )
}
