/**
 * StarterCard — one Starter Set build as the compact entity card: the entity
 * display language's ROW (`<Entity form="row">`), opening the build's
 * read-only sheet (`/starter/:kind/:id`).
 *
 * The front door and the Starter Set page both list the same thirteen builds,
 * so both draw them with this one card (`starterShelves.model.ts` builds them).
 *
 * What a build is made from (`CLASS | Engineer`, `CHASSIS | Mule`) is a
 * relation chip (`chips-and-actions.md` C11): it Peeks and opens that entity. A chip may not sit inside the card's
 * link (no nested interactive content), so the Row reads and the sheet's link
 * is laid over the whole card under the chips (`.su-starter-card__link`).
 */

import type { StarterKind } from '../../lib/starterSet/starterTemplates'
import { cn, Entity, FOCUS_RING } from '../../components/index'
import { AppLink } from '../../components/shared/AppLink'
import type { StarterBuild } from './starterShelves.model'

type StarterCardProps = { kind: StarterKind; build: StarterBuild }

export function StarterCard({ kind, build }: StarterCardProps) {
  return (
    <div className="su-starter-card">
      <Entity form="row" model={build.model} lead omit={['kind']} relations={build.relations} />
      <AppLink
        href={`/starter/${kind}/${build.id}`}
        className={cn('su-starter-card__link', FOCUS_RING)}
      >
        <span className="su-sr-only">Read {build.name}</span>
      </AppLink>
    </div>
  )
}
