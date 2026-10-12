/**
 * StarterCard — one Starter Set build as the compact entity card: the entity
 * display language's ROW (`<Entity form="row">`) in link mode, opening the
 * build's read-only sheet (`/starter/:kind/:id`).
 *
 * The front door and the Starter Set page both list the same thirteen builds,
 * so both draw them with this one card (`starterShelves.ts` builds them).
 */

import { Entity } from 'component-lib'
import type { StarterKind } from '../../lib/starterSet/copyStarter'
import type { StarterBuild } from './starterShelves'

type StarterCardProps = { kind: StarterKind; build: StarterBuild }

export function StarterCard({ kind, build }: StarterCardProps) {
  return (
    <Entity
      form="row"
      model={build.model}
      lead
      omit={['kind']}
      mode={{
        kind: 'link',
        href: `/starter/${kind}/${build.id}`,
        attrs: { 'aria-label': `Read ${build.name}` },
      }}
    />
  )
}
