/**
 * MediatorPrep — the Mediator's door to their prep, on a Game's page
 * (ADR-066). Prep is the Mediator's own (their Encounters and NPCs, ADR-059),
 * kept in the Mediator's Kit on the Games page and run on the Mediator
 * screen, whose Mediate is the band's door; this section counts what is
 * ready and opens the Kit, where the two lists are, so the Game's page is
 * never a second place to make it.
 */

import { Button, SlabSection } from '../../components/index'
import { useHydrateEntities, useNpcs } from '../../lib/entities'
import { useHydrateOnMount } from '../../lib/entities/useHydrateEntities'
import { MEDIATORS_KIT_ANCHOR } from '../../lib/games/gameRoster'
import { playGamesCopy } from '../../messages/play-games'
import { useEncounters } from '../../replica/collections'

export function MediatorPrep() {
  useHydrateEntities(['npc'])
  useHydrateOnMount(() => useEncounters.getState().hydrate())
  const encounters = useEncounters((s) => s.encounters.length)
  const npcs = useNpcs().length
  return (
    <SlabSection
      as="h2"
      id="mediator-prep-heading"
      title={playGamesCopy('yourPrep')}
      count={[
        { label: playGamesCopy('encounters'), value: encounters },
        { label: playGamesCopy('npcs'), value: npcs },
      ]}
      actions={
        <Button href={`/games#${MEDIATORS_KIT_ANCHOR}`} variant="default" size="compact">
          {playGamesCopy('openTheMediatorsKit')}
        </Button>
      }
    />
  )
}
