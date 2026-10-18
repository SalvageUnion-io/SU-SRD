/**
 * PlayMediatorOpposition — the Mediator's centre column in a Scene (play.md
 * §10, wireframe pins 3–4): "Opposition", a Slab with + Add, then each NPC,
 * mech, squad or Bio-Titan on the tray as a unit box (`PlayNpcBox`, level 1),
 * then the chosen one's actions (`PlayNpcActions`).
 *
 * The Opposition is hidden from players (ADR-030 §5). + Add opens the picker
 * over the reference (`OppositionPicker`, saved patterns included), and Rename
 * and Remove ask first (`OppositionDialogs`). The chosen NPC is the screen's
 * own; until one is chosen it is the first still standing.
 */

import { useState } from 'react'
import { SheetPickerModal } from '../../build/sheet/SheetSection'
import type { rollForTable } from '../../components/index'
import { Button, EmptyState, Slab } from '../../components/index'
import { OppositionDialogs, OppositionPicker } from './OppositionPicker'
import type { TrayNpc } from './opposition.model'
import { PlayNpcActions } from './PlayNpcActions'
import { PlayNpcBox } from './PlayNpcBox'
import type { PlayMediator } from './usePlayMediator'

type PlayMediatorOppositionProps = {
  mediator: PlayMediator
  /** The dice the NPC actions roll (a test injects its own). */
  rollFor?: typeof rollForTable
}

export function PlayMediatorOpposition({ mediator, rollFor }: PlayMediatorOppositionProps) {
  const { npcs, tray, canWrite, onFailure } = mediator
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [removing, setRemoving] = useState<TrayNpc | null>(null)
  const [renaming, setRenaming] = useState<TrayNpc | null>(null)
  const chosen =
    npcs?.find((n) => n.id === chosenId) ?? npcs?.find((n) => !n.down) ?? npcs?.[0] ?? null
  const fail = (write: Promise<unknown>) => void write.catch(onFailure)

  return (
    <>
      <Slab
        as="h2"
        label="Opposition"
        actions={
          <Button
            variant="default"
            size="mini"
            disabled={!canWrite}
            aria-label="Add opposition from the reference"
            onClick={() => setPicking(true)}
          >
            + Add
          </Button>
        }
      />
      {npcs === null ? (
        <EmptyState variant="inline" body="The tray is on its way." />
      ) : npcs.length === 0 ? (
        <EmptyState
          variant="inline"
          body="No opposition yet. Add NPCs, Mechs, Squads and Creatures from the reference; players never see them."
        />
      ) : (
        <ul className="su-play-npcs" aria-label="Opposition">
          {npcs.map((npc) => (
            <PlayNpcBox
              key={npc.id}
              npc={npc}
              chosen={chosen?.id === npc.id}
              onChoose={() => setChosenId(npc.id)}
              canWrite={canWrite}
              onHp={(next) => fail(tray.setHp(npc, next))}
              onRename={() => setRenaming(npc)}
              onRemove={() => setRemoving(npc)}
            />
          ))}
        </ul>
      )}
      {chosen !== null && (
        <PlayNpcActions
          key={chosen.id}
          npc={chosen}
          canWrite={canWrite}
          onMorale={() => fail(tray.morale(chosen))}
          rollFor={rollFor}
        />
      )}
      <SheetPickerModal
        open={picking}
        onClose={() => setPicking(false)}
        title="Add opposition from the reference"
        floating
      >
        <OppositionPicker
          npcs={npcs ?? []}
          saved={mediator.savedPatterns}
          onAdd={(schema, entity, draw) => fail(tray.add(schema, entity, draw))}
        />
      </SheetPickerModal>
      <OppositionDialogs
        removing={removing}
        renaming={renaming}
        onClose={() => {
          setRemoving(null)
          setRenaming(null)
        }}
        writes={tray}
      />
    </>
  )
}
