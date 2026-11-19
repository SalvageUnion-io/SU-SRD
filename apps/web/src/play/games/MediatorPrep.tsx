/**
 * MediatorPrep — the Mediator's door to their prep, on a Game's page
 * (ADR-065). Prep is made and kept in the Training Bay (its Encounters and NPCs
 * shelves, ADR-059) and run on the Mediator screen, whose Mediate is the
 * band's door; this section counts what is ready and links to where it is
 * kept, so the Game's page is never a second place to make it.
 */

import { Button, SlabSection } from '../../components/index'
import { useHydrateEntities, useNpcs } from '../../lib/entities'
import { useHydrateOnMount } from '../../lib/entities/useHydrateEntities'
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
        <Button href="/" variant="default" size="compact">
          {playGamesCopy('prepInTheTrainingBay')}
        </Button>
      }
    />
  )
}
