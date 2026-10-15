import { useContext } from 'react'
import type { RefEntity, RefMetaEntity } from 'salvageunion-reference'
import { Entity } from '../../entity/Entity'
import { InsidePeekContext } from '../../entity/peekContext'
import { useEntityHref } from '../entityHrefContext'
import { cardKey } from './cardHelpers'
import type { ReferenceCardEntity } from './referenceEntityCardTypes'

/**
 * A BIG GROUPING of entities as Tokens (owner's call, 2026-10-14: "any big
 * grouping should be tokens"): a guide step's options, a catalog choice's
 * qualifying entities. A real list, so a screen reader announces its count;
 * the Tokens wrap into as many full-width columns as the measure holds
 * (`.su-entity-token-list--grid`). Each opens its Page and Peeks its whole
 * card; inside a Peek it reads only.
 */
export function EntityTokenList({
  entities,
  label,
}: {
  entities: ReferenceCardEntity[]
  /** The list's accessible name ("Craft your Systems"). */
  label: string
}) {
  return (
    <ul aria-label={label} className="su-entity-token-list su-entity-token-list--grid">
      {entities.map((entity, index) => (
        <li key={cardKey(entity, index)}>
          <ListToken data={entity} />
        </li>
      ))}
    </ul>
  )
}

function ListToken({ data }: { data: ReferenceCardEntity }) {
  const href = useEntityHref(data as RefEntity)
  const insidePeek = useContext(InsidePeekContext)
  return (
    <Entity
      form="token"
      entity={data as RefMetaEntity}
      mode={insidePeek ? { kind: 'read' } : href ? { kind: 'link', href } : { kind: 'link' }}
    />
  )
}
