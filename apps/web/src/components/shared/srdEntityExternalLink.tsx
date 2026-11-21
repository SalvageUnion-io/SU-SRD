import { entityHref } from '../../lib/entityHref'
import { sharedCopy } from '../../messages/components-shared'
import type { EntityExternalLinkBuilder } from '../index'
import { InlineRef } from '../index'
import { DocumentLinks } from '../islands/DocumentLinks'

/**
 * The app's app-wide "View in the Reference" cross-link builder.
 *
 * Supplied as the entity surface's `externalLink` (set at the app's root, above
 * `EntityPageHost`, so the detail dialog it mounts reads it too),
 * so every FULL — non-compact, non-listing — entity card, including the
 * `useDetailModal` detail view, uniformly renders the link in its foot band.
 * Compact/listing cards stay uncluttered by design; an entity
 * with no page gets no link. The path is the app's one entity href
 * (`entityHref`, ADR-011), drawn as the one prose link, `InlineRef`, in this tab
 * and with no arrow: the Reference and the builder are one union (ruleset
 * §3.11, EDL E5).
 */
export const srdEntityExternalLink: EntityExternalLinkBuilder = (entity, options) => {
  const href = entityHref(entity)
  if (href === undefined) return undefined

  const entityName = 'name' in entity && typeof entity.name === 'string' ? entity.name : undefined

  // A Reference page, never the app's route: a plain anchor (DocumentLinks).
  return (
    <DocumentLinks>
      <InlineRef
        href={href}
        aria-label={
          entityName
            ? sharedCopy('viewInTheReference2', { entityName })
            : sharedCopy('viewInTheReference')
        }
        // `.su-srd-entity-external-link` (`styles/build/unitSlot.css`): its 24px target.
        className="su-srd-entity-external-link"
        // On a Peek's plate: its way out, never a tab stop (E16).
        {...(options?.inPeek ? { 'data-peek-out': '', tabIndex: -1 } : {})}
      >
        {sharedCopy('viewInTheReference')}
      </InlineRef>
    </DocumentLinks>
  )
}
