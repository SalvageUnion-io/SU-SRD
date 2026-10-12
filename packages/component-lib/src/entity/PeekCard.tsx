import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../components/referenceEntity/card/ReferenceEntityCard'
import { InsidePeekContext } from './peekContext'

/**
 * The PEEK's card (E16): the entity read-only and terminal. Until the Card form
 * lands (phase 4) it is `ReferenceEntityCard` small, at full extent, flat (no
 * speckle, ruleset §3.5), inside `InsidePeekContext`, which makes everything
 * in it act on nothing: no links (Mentions and Tags go inert), no roll-table
 * controls, no actions chip, children as Tokens, and no Peek inside it.
 */
export function PeekCard({ entity }: { entity: SURefEntity }) {
  return (
    <InsidePeekContext.Provider value={true}>
      <ReferenceEntityCard data={entity} size="small" extent="full" texture={false} />
    </InsidePeekContext.Provider>
  )
}
