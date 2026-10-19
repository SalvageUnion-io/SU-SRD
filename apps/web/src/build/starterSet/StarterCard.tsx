/**
 * StarterCard — one Starter Set build as the compact entity card: the entity
 * display language's ROW (`<Entity form="row">`), opening the build's
 * read-only sheet (`/starter/:kind/:id`).
 *
 * The front door and the Starter Set page both list the same thirteen builds,
 * so both draw them with this one card (`starterShelves.model.ts` builds them).
 *
 * What a build is made from (`CLASS | Engineer`, `CHASSIS | Mule`) is a
 * relation chip (`chips-and-actions.md` C11): it Peeks and opens that entity.
 * The host's controls (signed in, "Copy to…") are the chip group's last slot
 * (C8, hard rule R6). Neither may sit inside the sheet's link (no nested
 * interactive content), so the Row is a covered link Row: the link is an empty
 * cover over the whole card and the chips are raised above it.
 */

import type { ReactNode } from 'react'
import type { StarterKind } from '../../lib/starterSet/starterTemplates'
import { Entity } from '../../components/index'
import type { StarterBuild } from './starterShelves.model'

type StarterCardProps = {
  kind: StarterKind
  build: StarterBuild
  /** The host's controls, the chip group's last slot ("Copy to…"). */
  controls?: ReactNode
}

export function StarterCard({ kind, build, controls }: StarterCardProps) {
  return (
    <Entity
      form="row"
      model={build.model}
      mode={{
        kind: 'link',
        href: `/starter/${kind}/${build.id}`,
        attrs: { 'aria-label': `Read ${build.name}` },
      }}
      omit={['kind']}
      relations={build.relations}
      controls={controls}
    />
  )
}
