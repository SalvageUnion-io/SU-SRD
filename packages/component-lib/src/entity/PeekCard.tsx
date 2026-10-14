import type { SURefEntity } from 'salvageunion-reference'
import type { Down } from '../components/referenceEntity/card/cardChrome'
import { ReferenceEntityCard } from '../components/referenceEntity/card/ReferenceEntityCard'
import { InsidePeekContext } from './peekContext'

/**
 * The PEEK's card (E16): the entity read-only and terminal. It is
 * `ReferenceEntityCard` small, at full extent, flat (no
 * speckle, ruleset §3.5), inside `InsidePeekContext`, which makes everything
 * in it act on nothing: no links (Mentions and Tags go inert), no roll-table
 * controls, no actions chip, children as Tokens, and no Peek inside it. A
 * `down` Peek (its trigger damaged or destroyed) paints its band as the trigger does.
 */
export function PeekCard({ entity, down = false }: { entity: SURefEntity; down?: Down }) {
  return (
    <InsidePeekContext.Provider value={true}>
      <ReferenceEntityCard
        data={entity}
        size="small"
        extent="full"
        texture={false}
        hostDown={down}
      />
    </InsidePeekContext.Provider>
  )
}
