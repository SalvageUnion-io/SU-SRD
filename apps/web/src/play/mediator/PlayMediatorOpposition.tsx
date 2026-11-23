/**
 * PlayMediatorOpposition — the Mediator's centre column in a Scene (play.md
 * §10): "Opposition", a Slab with Run an encounter and + Add, the encounter
 * running (`RUNNING | its name`, End; ADR-059), the area the crew is
 * salvaging (`AREA | its name, Tech Level and Supply`, set through
 * `SalvageAreaDialog`, Core Book p.245), then each NPC,
 * mech, squad or Bio-Titan on the tray as a unit box (`PlayNpcBox`, level 1);
 * Actions on a box opens that unit's actions inside its own card
 * (`PlayNpcActions`, r4 D1), each unit's on its own, shut until asked for.
 * The units come first (r7 C8): on a phone the running encounter's Briefing
 * and Notes (`notes`, r4 D3), then the Scene's conditions (`PlayMediatorScene`,
 * one row), stand under them.
 *
 * Behind the `encounterSheet` flag (ADR-059 §5), an encounter's groups sit
 * together under their own Slab (`PlayNpcGroup`), with one Reaction and one
 * Morale roll each; a Mech or Creature whose Morale check is due says so on
 * its box, with Roll; and each wave the running encounter holds back has
 * Bring in. Nothing is rolled, retreats or arrives on its own (ADR-007).
 *
 * Clear the field, under the list, empties the tray in one confirm; End asks
 * whether to clear it too while it holds anything (`ClearFieldDialogs`).
 *
 * The Opposition is hidden from players (ADR-030 §5). + Add opens the picker
 * over the reference (`OppositionPicker`, saved patterns included), and Rename
 * and Delete ask first (`OppositionDialogs`). Which units' actions are open is
 * the screen's own.
 */

import { heldGroups, heldWaves } from 'game-domain/games/encounters'
import { proposalTargets } from 'game-domain/games/proposals'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { SheetPickerModal } from '../../build/sheet/SheetPickerModal'
import { undoToast } from '../../build/sheet/undoToast.model'
import { SkipLink } from '../../components/app'
import type { rollForTable } from '../../components/index'
import { Button, EmptyState, Slab, Stat, toast, tokens } from '../../components/index'
import { flagOn } from '../../lib/flags'
import type { MoraleRoll } from '../../lib/rules/opposition'
import { moraleDue } from '../../lib/rules/opposition'
import { playCopy } from '../../messages/play'
import { mediatorCopy } from '../../messages/play-mediator'
import { SalvageAreaDialog } from '../SalvageAreaDialog'
import { sceneConditionNames } from '../useScene'
import { useSessionLive } from '../useSessionLive'
import { ClearFieldDialog, EndEncounterDialog } from './ClearFieldDialogs'
import { OppositionDialogs, OppositionPicker } from './OppositionPicker'
import type { TrayEntry, TrayNpc } from './opposition.model'
import { groupRoll, trayEntries } from './opposition.model'
import { dropChange, keepChange } from './oppositionUndo.model'
import { PlayMediatorScene } from './PlayMediatorScene'
import type { NpcHit } from './PlayNpcActions'
import { PlayNpcActions } from './PlayNpcActions'
import { PlayNpcBox } from './PlayNpcBox'
import { PlayNpcGroup } from './PlayNpcGroup'
import { hitLandsOn, newestHit } from './pilotHit.model'
import { RunEncounterDialog } from './RunEncounterDialog'
import { useInitiative } from './useInitiative'
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
  rollFor?: typeof rollForTable | undefined
  /** Where a weapon's hit can be proposed (`PlayNpcActions`). */
  hit?: NpcHit
  /** Below `lg`, the running encounter's Briefing and Notes, under its name. */
  notes?: ReactNode
}

export function PlayMediatorOpposition({
  mediator,
  rollFor,
  hit,
  notes,
}: PlayMediatorOppositionProps) {
  const { npcs, tray, prep, canWrite, onFailure } = mediator
  // The units whose actions are open, each in its own card.
  const [openIds, setOpenIds] = useState<readonly string[]>([])
  const [picking, setPicking] = useState(false)
  const [running, setRunning] = useState(false)
  const [removing, setRemoving] = useState<TrayNpc | null>(null)
  const [renaming, setRenaming] = useState<TrayNpc | null>(null)
  const [settingArea, setSettingArea] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [ending, setEnding] = useState(false)
  const { area } = mediator
  const sessionLive = useSessionLive(mediator.gameId)
  // A Pilot's hit, offered on each unit it can land on until applied (r7 C5).
  const [spent, setSpent] = useState<ReadonlySet<string>>(() => new Set())
  const pilotHit = canWrite ? newestHit(mediator.rolls, spent) : null
  const hitOn = (npc: TrayNpc) => {
    if (pilotHit === null || !hitLandsOn(pilotHit, npc)) return undefined
    const words = {
      who: pilotHit.who,
      amount: pilotHit.damage.amount,
      unit: pilotHit.damage.damageType,
      name: npc.name,
    }
    return {
      label: mediatorCopy('pilotHit', words),
      name: mediatorCopy('pilotHitFor', words),
      onApply: () => {
        const before = npc.currentHp
        const after = Math.max(0, before - pilotHit.damage.amount)
        const { rollId } = pilotHit
        setSpent((ids) => new Set([...ids, rollId]))
        fail(tray.setHp(npc, after))
        undoToast(
          mediatorCopy('pilotHitApplied', { ...words, before, after }),
          () => {
            setSpent((ids) => new Set([...ids].filter((id) => id !== rollId)))
            fail(tray.setHp(npc, before))
          },
          `opposition-${mediator.gameId}`
        )
      },
    }
  }
  // A vital's change is undoable (r8 B4): the sheet's Undo toast, and the ⋯'s Undo last change.
  const changed = (
    npc: TrayNpc,
    label: string,
    before: number,
    after: number,
    write: (value: number) => Promise<unknown>
  ) => {
    fail(write(after))
    if (before === after) return
    const change = { label: `${npc.name} · ${label}`, undo: () => fail(write(before)) }
    keepChange(mediator.gameId, change)
    undoToast(
      mediatorCopy('vitalChanged', { name: npc.name, label, before, after }),
      () => {
        dropChange(mediator.gameId, change)
        change.undo()
      },
      `opposition-${mediator.gameId}`
    )
  }
  // Each unit standing carries its Group Initiative mark while one is kept (r6 B4).
  const { initiative, setActed, markActed } = useInitiative(mediator.gameId, onFailure, mediator)
  // The Scene's conditions that are on: End asks whether to clear them (r4 A11).
  const sceneOn = sceneConditionNames(mediator.scene.conditions)
  const fail = (write: Promise<unknown>) => void write.catch(onFailure)
  const clearDowned = () =>
    fail(
      tray
        .clearDowned()
        .then(({ removed, undo }) =>
          undoToast(
            mediatorCopy('clearedTheDowned', { count: removed }),
            () => fail(undo()),
            `opposition-${mediator.gameId}`
          )
        )
    )
  const grouping = flagOn('encounterSheet')
  // A downed unit keeps its place, folded and marked Down (r8 B5): the field never reorders under the pointer.
  const entries: TrayEntry[] =
    npcs === null
      ? []
      : grouping
        ? trayEntries(npcs)
        : npcs.map((npc) => ({ kind: 'alone' as const, npc }))
  const held = grouping && prep.running !== null ? heldWaves(prep.running) : []
  // The crew's Mechs, whose holds a wreck's haul can be proposed to (r5 B2).
  const wreckMechs = proposalTargets(mediator.crew)
    .filter((t) => t.kind === 'mech')
    .map((t) => ({ id: t.id, label: t.label }))

  // A group's roll reads once, under its header (r7 C7, MD7-08): never again on its members.
  const box = (unit: TrayNpc, groupLast: MoraleRoll | null = null) => {
    const npc =
      groupLast !== null && unit.lastRoll?.rolledAt === groupLast.rolledAt
        ? { ...unit, lastRoll: null }
        : unit
    return boxOf(npc)
  }
  const boxOf = (npc: TrayNpc) => (
    <PlayNpcBox
      key={npc.id}
      npc={npc}
      chosen={openIds.includes(npc.id)}
      onChoose={() =>
        setOpenIds((ids) =>
          ids.includes(npc.id) ? ids.filter((id) => id !== npc.id) : [...ids, npc.id]
        )
      }
      actions={
        openIds.includes(npc.id) ? (
          <PlayNpcActions
            npc={npc}
            canWrite={canWrite}
            onMorale={() => fail(tray.morale(npc))}
            hit={hit}
            rollFor={rollFor}
            // Rolling an action is its turn: it is marked Acted (r7 C3).
            onActed={() => markActed(npc.id)}
            counts={{
              round: initiative?.round ?? 0,
              onUses: (key, spent) => fail(tray.setUses(npc, key, spent)),
              onTitanic: (spent) => fail(tray.setTitanic(npc, spent, initiative?.round ?? 0)),
            }}
          />
        ) : null
      }
      canWrite={canWrite}
      onHp={(next) =>
        changed(npc, npc.statKind === 'sp' ? 'SP' : 'HP', npc.currentHp, next, (v) =>
          tray.setHp(npc, v)
        )
      }
      onRename={() => setRenaming(npc)}
      onRemove={() => setRemoving(npc)}
      onSalvage={mediator.salvageWreck}
      hasCrawler={mediator.crawler?.held === true}
      mechs={wreckMechs}
      onSalvageRoll={tray.salvageRoll}
      rollFor={rollFor}
      onImportant={(important) => fail(tray.setImportant(npc, important))}
      onReactor={(patch) => {
        const reactor = npc.reactor
        if (reactor === null) return
        if (patch.currentEp !== undefined) {
          changed(npc, mediatorCopy('ep'), reactor.ep, patch.currentEp, (v) =>
            tray.setReactor(npc, { currentEp: v })
          )
        } else if (patch.currentHeat !== undefined) {
          changed(npc, mediatorCopy('heat'), reactor.heat, patch.currentHeat, (v) =>
            tray.setReactor(npc, { currentHeat: v })
          )
        }
      }}
      onCritical={() => fail(tray.critical(npc))}
      onHeatCheck={() => fail(tray.heatCheck(npc))}
      moraleDue={grouping && moraleDue(npc)}
      onMorale={() => fail(tray.morale(npc))}
      hit={hitOn(npc)}
      acted={
        initiative === null || npc.down
          ? undefined
          : {
              acted: initiative.acted.includes(npc.id),
              onToggle: canWrite
                ? () => setActed(npc.id, !initiative.acted.includes(npc.id))
                : undefined,
            }
      }
    />
  )

  return (
    <>
      <Slab
        as="h2"
        id="mediate-opposition"
        label={mediatorCopy('opposition')}
        flush
        actions={
          <>
            <Button
              variant="default"
              size="compact"
              disabled={!canWrite}
              onClick={() => setRunning(true)}
            >
              {mediatorCopy('runAnEncounter')}
            </Button>
            <Button
              variant="default"
              size="compact"
              disabled={!canWrite}
              aria-label={mediatorCopy('setArea')}
              onClick={() => setSettingArea(true)}
            >
              {mediatorCopy('area')}
            </Button>
            <Button
              variant="default"
              size="compact"
              disabled={!canWrite}
              aria-label={mediatorCopy('addOppositionFromTheReference')}
              data-opposition-add=""
              onClick={() => setPicking(true)}
            >
              {mediatorCopy('add')}
            </Button>
          </>
        }
      />
      <OppositionJumps npcs={npcs ?? []} />
      {prep.running !== null && (
        <div style={RUNNING} role="status">
          <Stat label={mediatorCopy('running')} value={prep.running.name} size="mini" />
          <Button
            variant="ghost"
            size="mini"
            disabled={!canWrite}
            aria-label={mediatorCopy('endEncounter', { name: prep.running.name })}
            // With the field empty there is nothing to ask about.
            onClick={() =>
              (npcs?.length ?? 0) > 0 || sceneOn !== '' ? setEnding(true) : fail(prep.end())
            }
          >
            {mediatorCopy('endTheEncounter')}
          </Button>
        </div>
      )}
      {prep.running !== null &&
        held.map((wave) => (
          <div key={wave} style={RUNNING} role="status">
            <Stat
              label={mediatorCopy('wave', { wave })}
              value={mediatorCopy('waveHeld', {
                groups: heldGroups(prep.running, wave).join(', '),
              })}
              size="mini"
            />
            <Button
              variant="default"
              size="mini"
              disabled={!canWrite}
              aria-label={mediatorCopy('bringInWave', { wave })}
              onClick={() => fail(prep.bringIn(wave))}
            >
              {mediatorCopy('bringIn')}
            </Button>
          </div>
        ))}
      {area.area !== null && (
        <div style={RUNNING} role="status">
          <Stat
            label={mediatorCopy('area')}
            value={mediatorCopy('areaValue', {
              name: area.area.name === '' ? '' : `${area.area.name} · `,
              tl: area.area.techLevel,
              supply: area.area.supply,
            })}
            size="mini"
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
          {entries.map((entry) =>
            entry.kind === 'alone' ? (
              box(entry.npc)
            ) : (
              <PlayNpcGroup
                key={entry.id}
                id={entry.id}
                name={entry.name}
                members={entry.members}
                canWrite={canWrite}
                onRoll={(table) => fail(tray.groupRoll(entry, table))}
              >
                {entry.members.map((npc) => box(npc, groupRoll(entry.members)))}
              </PlayNpcGroup>
            )
          )}
        </ul>
      )}
      {npcs !== null && npcs.length > 0 && (
        <div style={RUNNING}>
          {/* One press for every downed unit, with Undo, never a confirm each (r6 B8). */}
          {npcs.some((npc) => npc.down) && (
            <Button variant="ghost" size="mini" disabled={!canWrite} onClick={clearDowned}>
              {mediatorCopy('clearTheDowned')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="mini"
            disabled={!canWrite}
            onClick={() => setClearing(true)}
          >
            {mediatorCopy('clearTheField')}
          </Button>
        </div>
      )}
      {/* The units first (r7 C8, MD7-16): the briefing, then the Scene, under them. */}
      {prep.running !== null ? notes : null}
      <PlayMediatorScene mediator={mediator} rollFor={rollFor} />
      <SheetPickerModal
        open={picking}
        onClose={() => setPicking(false)}
        title={mediatorCopy('addOppositionFromTheReference')}
        floating
      >
        <OppositionPicker
          npcs={npcs ?? []}
          saved={mediator.savedPatterns}
          yours={mediator.ownNpcs}
          onAdd={(schema, entity, draw) => fail(tray.add(schema, entity, draw))}
          onAddBuilt={(npc, name) => fail(tray.addBuilt(npc, name))}
        />
      </SheetPickerModal>
      <RunEncounterDialog
        open={running}
        onClose={() => setRunning(false)}
        encounters={prep.encounters}
        gameId={mediator.gameId}
        onTray={npcs?.length ?? 0}
        sessionLive={sessionLive}
        onRun={async (encounterId, clear, startSession) => {
          try {
            return await prep.run(encounterId, clear, startSession)
          } catch (err) {
            onFailure(err)
            throw err
          }
        }}
      />
      <ClearFieldDialog
        open={clearing}
        onClose={() => setClearing(false)}
        onTray={npcs?.length ?? 0}
        onClear={async () => {
          await tray.clear()
          toast.success(mediatorCopy('fieldCleared'))
        }}
      />
      <EndEncounterDialog
        name={ending ? (prep.running?.name ?? null) : null}
        onClose={() => setEnding(false)}
        onTray={npcs?.length ?? 0}
        scene={sceneOn}
        onEnd={async (clear, clearScene) => {
          await prep.end(clear)
          if (clearScene) await mediator.scene.set([])
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

/**
 * The Opposition heading's own list of units (r6 B11): off screen until
 * focused, a jump to each unit's vitals, then Add. The screen's skip links
 * stay four whatever the size of the fight; this list follows the heading
 * the Opposition jump lands on.
 */
function OppositionJumps({ npcs }: { npcs: readonly TrayNpc[] }) {
  const focus = (selector: string) => document.querySelector<HTMLElement>(selector)?.focus()
  return (
    <nav aria-label={mediatorCopy('oppositionUnits')} data-opposition-units="">
      {npcs.map((npc) => (
        <SkipLink
          key={npc.id}
          to="mediate-opposition"
          onFollow={() => focus(`[data-npc-id="${npc.id}"] .su-vital-gauge__value-button`)}
        >
          {playCopy('skipTo', { name: mediatorCopy('vitalsOf', { name: npc.name }) })}
        </SkipLink>
      ))}
      <SkipLink to="mediate-opposition" onFollow={() => focus('[data-opposition-add]')}>
        {playCopy('skipTo', { name: mediatorCopy('addOpposition') })}
      </SkipLink>
    </nav>
  )
}
