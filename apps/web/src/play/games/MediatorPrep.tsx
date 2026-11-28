/**
 * MediatorPrep — the door to a Game's Prep, on its page (ADR-067 §3): what is
 * ready for THIS Game (its encounters, the NPCs moved into it) and the way
 * into its Prep page, where they are ordered beside the Game's notes and
 * sessions. The Mediator's Kit on the Games front lists the same records
 * across every Game.
 */

import { Button, SlabSection, Text } from '../../components/index'
import { useHydrateEntities, useOwnUnits } from '../../lib/entities'
import { useHydrateOnMount } from '../../lib/entities/useHydrateEntities'
import { playGamesCopy } from '../../messages/play-games'
import { useEncounters } from '../../replica/collections'
import { HUB_ACTIONS } from './hubStyles.model'
import { gamePrepPath } from './prep/gamePrep.model'

export function MediatorPrep({ gameId }: { gameId: string }) {
  useHydrateEntities(['npc'])
  useHydrateOnMount(() => useEncounters.getState().hydrate())
  const encounters = useEncounters((s) => s.encounters.filter((e) => e.gameId === gameId).length)
  const npcs = useOwnUnits('npc').filter((n) => n.gameId === gameId).length
  return (
    <SlabSection
      as="h2"
      id="mediator-prep-heading"
      title={playGamesCopy('yourPrep')}
      count={[
        { label: playGamesCopy('encounters'), value: encounters },
        { label: playGamesCopy('npcs'), value: npcs },
      ]}
    >
      {/* The door is the section's body, under its title: beside it, it would
          wrap above the title in this narrow column. */}
      <Text variant="hint">{playGamesCopy('prepLede')}</Text>
      <div style={HUB_ACTIONS}>
        <Button href={gamePrepPath(gameId)} variant="default" size="compact">
          {playGamesCopy('openPrep')}
        </Button>
      </div>
    </SlabSection>
  )
}
