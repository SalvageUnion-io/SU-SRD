import { useContext } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { MiniGrid } from '../../containers/MiniGrid'
import { Entity } from '../../entity/Entity'
import { InsidePeekContext } from '../../entity/peekContext'
import { cardKey } from './cardHelpers'
import type { ReferenceCardEntity } from './referenceEntityCardTypes'

/**
 * A BIG GROUPING of entities as Minis (owner's call, 2026-10-14: "any big
 * grouping should be tokens"): a guide step's options off its Page (on it
 * they are open Compacts, N8), a catalog choice's qualifying entities. Each is a
 * CONTENTFUL Mini (N3; owner's call,
 * 2026-10-20), its head and then its text, in the masonry grid
 * (`MiniGrid`): one column on a phone, two across a page. Each opens its
 * Page where the surface says (the SRD's route, the app's Page opener) and
 * Peeks its whole card; inside a Peek it reads only.
 */
export function EntityMiniList({
  entities,
  label,
}: {
  entities: ReferenceCardEntity[]
  /** The list's accessible name ("Craft your Systems"). */
  label: string
}) {
  return (
    <MiniGrid label={label}>
      {entities.map((entity, index) => (
        <li key={cardKey(entity, index)}>
          <ListMini data={entity} />
        </li>
      ))}
    </MiniGrid>
  )
}

const READ = { kind: 'read' } as const
const LINK = { kind: 'link' } as const

function ListMini({ data }: { data: ReferenceCardEntity }) {
  const insidePeek = useContext(InsidePeekContext)
  return (
    <Entity
      size="mini"
      context="browse"
      entity={data as RefMetaEntity}
      mode={insidePeek ? READ : LINK}
      body={{}}
    />
  )
}
