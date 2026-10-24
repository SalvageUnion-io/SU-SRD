/**
 * PlayMediatorOpposition — the Mediator's centre column in a Scene (play.md
 * §10): "Opposition", a Slab with Run an encounter and + Add, the encounter
 * running (`RUNNING | its name`, End; ADR-059), the area the crew is
 * salvaging (`AREA | its name, Tech Level and Supply`, set through
 * `SalvageAreaDialog`, Core Book p.245), then each NPC,
 * mech, squad or Bio-Titan on the tray as a unit box (`PlayNpcBox`, level 1),
 * then the chosen one's actions (`PlayNpcActions`).
 *
 * The Opposition is hidden from players (ADR-030 §5). + Add opens the picker
 * over the reference (`OppositionPicker`, saved patterns included), and Rename
 * and Delete ask first (`OppositionDialogs`). The chosen NPC is the screen's
 * own; until one is chosen it is the first still standing.
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SheetPickerModal } from '../../build/sheet/SheetPickerModal'
import type { rollForTable } from '../../components/index'
import { Button, EmptyState, Slab, Stat, tokens } from '../../components/index'
import { mediatorCopy } from '../../messages/play-mediator'
import { SalvageAreaDialog } from '../SalvageAreaDialog'
import { OppositionDialogs, OppositionPicker } from './OppositionPicker'
import type { TrayNpc } from './opposition.model'
import { PlayNpcActions } from './PlayNpcActions'
import { PlayNpcBox } from './PlayNpcBox'
import { RunEncounterDialog } from './RunEncounterDialog'
import type { PlayMediator } from './usePlayMediator'

/** The encounter running: its chip, then End, on one line. */
const RUNNING = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

type PlayMediatorOppositionProps = {
  mediator: PlayMediator
  /** The dice the NPC actions roll (a test injects its own). */
  rollFor?: typeof rollForTable
}

export function PlayMediatorOpposition({ mediator, rollFor }: PlayMediatorOppositionProps) {
  const { npcs, tray, prep, canWrite, onFailure } = mediator
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [running, setRunning] = useState(false)
  const [removing, setRemoving] = useState<TrayNpc | null>(null)
  const [renaming, setRenaming] = useState<TrayNpc | null>(null)
  const [settingArea, setSettingArea] = useState(false)
  const { area } = mediator
  const chosen =
    npcs?.find((n) => n.id === chosenId) ?? npcs?.find((n) => !n.down) ?? npcs?.[0] ?? null
  const fail = (write: Promise<unknown>) => void write.catch(onFailure)

  return (
    <>
      <Slab
        as="h2"
        label={mediatorCopy('opposition')}
        actions={
          <>
            <Button
              variant="default"
              size="mini"
              disabled={!canWrite}
              onClick={() => setRunning(true)}
            >
              {mediatorCopy('runAnEncounter')}
            </Button>
            <Button
              variant="default"
              size="mini"
              disabled={!canWrite}
              aria-label={mediatorCopy('setArea')}
              onClick={() => setSettingArea(true)}
            >
              {mediatorCopy('area')}
            </Button>
            <Button
              variant="default"
              size="mini"
              disabled={!canWrite}
              aria-label={mediatorCopy('addOppositionFromTheReference')}
              onClick={() => setPicking(true)}
            >
              {mediatorCopy('add')}
            </Button>
          </>
        }
      />
      {prep.running !== null && (
        <div style={RUNNING} role="status">
          <Stat label={mediatorCopy('running')} value={prep.running.name} size="compact" />
          <Button
            variant="ghost"
            size="mini"
            disabled={!canWrite}
            aria-label={mediatorCopy('endEncounter', { name: prep.running.name })}
            onClick={() => fail(prep.end())}
          >
            {mediatorCopy('end')}
          </Button>
        </div>
      )}
      {area.area !== null && (
        <div style={RUNNING} role="status">
          <Stat
            label={mediatorCopy('area')}
            value={mediatorCopy('areaValue', {
              name: area.area.name === '' ? '' : `${area.area.name} · `,
              tl: area.area.techLevel,
              supply: area.area.supply,
            })}
            size="compact"
          />
          <Button
            variant="ghost"
            size="mini"
            disabled={!canWrite}
            aria-label={mediatorCopy('clearAreaLabel')}
            onClick={() => area.set(null)}
          >
            {mediatorCopy('clearArea')}
          </Button>
        </div>
      )}
      {npcs === null ? (
        <EmptyState variant="inline" body={mediatorCopy('theTrayIsOnIts')} />
      ) : npcs.length === 0 ? (
        <EmptyState variant="inline" body={mediatorCopy('noOppositionYetAddNpcs')} />
      ) : (
        <ul className="su-play-npcs" aria-label={mediatorCopy('opposition')}>
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
              onSalvage={mediator.salvageWreck}
              hasCrawler={mediator.crawler?.held === true}
              rollFor={rollFor}
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
        title={mediatorCopy('addOppositionFromTheReference')}
        floating
      >
        <OppositionPicker
          npcs={npcs ?? []}
          saved={mediator.savedPatterns}
          onAdd={(schema, entity, draw) => fail(tray.add(schema, entity, draw))}
        />
      </SheetPickerModal>
      <RunEncounterDialog
        open={running}
        onClose={() => setRunning(false)}
        encounters={prep.encounters}
        onTray={npcs?.length ?? 0}
        onRun={async (encounterId, clear) => {
          try {
            return await prep.run(encounterId, clear)
          } catch (err) {
            onFailure(err)
            throw err
          }
        }}
      />
      <SalvageAreaDialog
        key={settingArea ? 'open' : 'closed'}
        open={settingArea}
        area={area.area}
        onClose={() => setSettingArea(false)}
        onSave={area.set}
      />
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
