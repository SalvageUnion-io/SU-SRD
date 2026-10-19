import { useContext } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { Entity } from '../../entity/Entity'
import { InsidePeekContext } from '../../entity/peekContext'
import { cardKey } from './cardHelpers'
import type { ReferenceCardEntity } from './referenceEntityCardTypes'

/**
 * A BIG GROUPING of entities as Tokens (owner's call, 2026-10-14: "any big
 * grouping should be tokens"): a guide step's options, a catalog choice's
 * qualifying entities. A real list, so a screen reader announces its count;
 * one Token a line, filling it (N4). Each opens its Page where the surface
 * says (the SRD's route, the app's Page opener) and Peeks its whole card;
 * inside a Peek it reads only.
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
    <ul aria-label={label} className="su-entity-token-list">
      {entities.map((entity, index) => (
        <li key={cardKey(entity, index)}>
          <ListToken data={entity} />
        </li>
      ))}
    </ul>
  )
}

const READ = { kind: 'read' } as const
const LINK = { kind: 'link' } as const

function ListToken({ data }: { data: ReferenceCardEntity }) {
  const insidePeek = useContext(InsidePeekContext)
  return (
    <Entity
      form="token"
      context="browse"
      entity={data as RefMetaEntity}
      mode={insidePeek ? READ : LINK}
    />
  )
}
