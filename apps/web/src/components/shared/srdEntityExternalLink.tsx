import { entityHref } from '../../lib/entityHref'
import type { EntityExternalLinkBuilder } from '../index'
import { InlineRef } from '../index'

/**
 * The app's app-wide "View in the Reference" cross-link builder.
 *
 * Supplied as the entity surface's `externalLink` (set in `GameDataReady`),
 * so every FULL — non-compact, non-listing — entity card, including the
 * `useDetailModal` detail view, uniformly renders the link in its foot band.
 * Compact/listing cards stay uncluttered by design; an entity
 * with no page gets no link. The path is the app's one entity href
 * (`entityHref`, ADR-011), drawn as the one prose link, `InlineRef`, in this tab
 * and with no arrow: the Reference and the builder are one union (ruleset
 * §3.11, EDL E5).
 */
export const srdEntityExternalLink: EntityExternalLinkBuilder = (entity) => {
  const href = entityHref(entity)
  if (href === undefined) return undefined

  const entityName = 'name' in entity && typeof entity.name === 'string' ? entity.name : undefined

  return (
    <InlineRef
      href={href}
      aria-label={entityName ? `View ${entityName} in the Reference` : 'View in the Reference'}
      // `.su-srd-entity-external-link` (`styles/build/unitSlot.css`): its 24px target.
      className="su-srd-entity-external-link"
    >
      View in the Reference
    </InlineRef>
  )
}
