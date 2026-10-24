/**
 * PlayMediatorScene — the Scene's conditions in the Mediator's centre column
 * (play.md §10), over the Opposition: a Slab, "Scene" with the hour and An
 * hour passes, then every condition the books give a Scene as a toggle Mini
 * of its keyword (`SceneConditionMini`), pressed while the Scene is under it.
 * Every seat follows what is pressed: the Heat its Push and Hot actions make,
 * its range under Low Visibility.
 *
 * An hour passes asks first, listing each seat the hour asks something of
 * (`hourSteps`: aboard its Mech, on foot its Pilot), each ticked and
 * untickable for a unit sheltered from it. On confirm it counts the hour,
 * rolls each exposed Mech's table (Freezing) and the Scene's own (the
 * Anomalous Zone) on the Mediator's private log, proposes each unit's SP,
 * Heat or HP (ADR-030 §4), and tells the table what is the players' to do: a
 * Heat Check, an injury, a damaged part (ADR-007).
 */

import {
  freezingDamage,
  SCENE_CONDITIONS,
  sceneConditionsOf,
  sceneHourTables,
} from 'game-domain/rules/sceneConditions'
import type { SceneConditionId } from 'game-domain/schemas/scene'
import { SCENE_CONDITION_IDS } from 'game-domain/schemas/scene'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { resultForTable, SalvageUnionReference } from 'salvageunion-reference'
import {
  Button,
  Checkbox,
  ConfirmDialog,
  MiniGrid,
  rollForTable,
  Slab,
  tokens,
} from '../../components/index'
import { mediatorCopy } from '../../messages/play-mediator'
import { SceneConditionMini } from '../PlayScene'
import { recordPlayRoll } from '../playRolls.model'
import type { HourStep } from './sceneHour.model'
import { hourProposals, hourSteps } from './sceneHour.model'
import type { PlayMediator } from './usePlayMediator'

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const ROW = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[8],
} satisfies CSSProperties

/** The row of a roll table, verbatim. */
function rowText(table: string, roll: number): string {
  const row = resultForTable(SalvageUnionReference.RollTables.getByName(table)?.table, roll)
  return row.success ? (row.result.label ?? row.result.value) : ''
}

/** What one exposed unit is told to do this hour, beyond its proposals. */
function saidFor(step: HourStep, rolls: readonly { table: string; roll: number }[]): string[] {
  const said: string[] = []
  if (step.cost.heatCheck) said.push(mediatorCopy('hourHeatCheck'))
  for (const { table, roll } of rolls) {
    said.push(
      mediatorCopy('hourRolled', { table, roll, row: rowText(table, roll).replace(/\.$/, '') })
    )
  }
  for (const injury of step.cost.injuries) {
    said.push(
      injury === 'major' ? mediatorCopy('hourMajorInjury') : mediatorCopy('hourMinorInjury')
    )
  }
  return said
}

type PlayMediatorSceneProps = {
  mediator: PlayMediator
  /** The dice the hour rolls (a test injects its own). */
  rollFor?: typeof rollForTable
}

export function PlayMediatorScene({ mediator, rollFor = rollForTable }: PlayMediatorSceneProps) {
  const { scene, canWrite, crew } = mediator
  const id = useId()
  const [asking, setAsking] = useState(false)
  const [sheltered, setSheltered] = useState<ReadonlySet<string>>(new Set())
  const on = new Set<SceneConditionId>(scene.conditions)
  const names = sceneConditionsOf(scene.conditions)
    .map((c) => c.name)
    .join(', ')
  const steps = hourSteps(scene.conditions, crew)
  const tables = sceneHourTables(scene.conditions)
  const hourly = steps.length > 0 || tables.length > 0

  function toggle(id: SceneConditionId) {
    const next = on.has(id) ? scene.conditions.filter((c) => c !== id) : [...scene.conditions, id]
    // A refusal is said by `scene.set` (`usePlayMediator`'s toast).
    scene.set(next).catch(() => undefined)
  }

  async function roll(table: string, label: string): Promise<number> {
    const n = (await rollFor(table))(20)
    recordPlayRoll({ tableName: table, rolls: [n], label, outcome: rowText(table, n) })
    return n
  }

  async function passHour() {
    const hour = await scene.passHour()
    const lines: string[] = []
    for (const step of steps) {
      if (sheltered.has(step.key)) continue
      const rolls: { table: string; roll: number }[] = []
      for (const table of step.cost.tables) {
        rolls.push({
          table,
          roll: await roll(table, mediatorCopy('hourRollLabel', { label: step.label, table })),
        })
      }
      const extra = rolls.reduce(
        (sum, r) => sum + (r.table === 'Freezing' ? freezingDamage(r.roll) : 0),
        0
      )
      const reason = mediatorCopy('hourReason', { conditions: step.cost.from.join(', '), hour })
      for (const proposal of hourProposals(step, extra, reason)) await mediator.propose(proposal)
      const said = saidFor(step, rolls)
      if (said.length > 0)
        lines.push(mediatorCopy('hourLine', { label: step.label, said: said.join('; ') }))
    }
    for (const table of tables)
      await roll(table, mediatorCopy('hourSceneRollLabel', { table, hour }))
    await mediator.broadcast(
      [mediatorCopy('hourAlert', { hour, conditions: names }), ...lines].join(' ')
    )
  }

  return (
    <>
      <Slab
        as="h2"
        label={mediatorCopy('scene')}
        {...(scene.hours > 0 ? { count: { label: mediatorCopy('hour'), value: scene.hours } } : {})}
        actions={
          <Button
            variant="default"
            size="mini"
            disabled={!canWrite || !hourly}
            title={hourly ? undefined : mediatorCopy('nothingHourly')}
            onClick={() => {
              setSheltered(new Set())
              setAsking(true)
            }}
          >
            {mediatorCopy('anHourPasses')}
          </Button>
        }
      />
      <MiniGrid label={mediatorCopy('sceneConditions')} play>
        {SCENE_CONDITION_IDS.map((id) => {
          const condition = SCENE_CONDITIONS[id]
          return (
            <SceneConditionMini
              key={id}
              condition={condition}
              dim={!on.has(id)}
              mode={{
                kind: 'select',
                role: 'toggle',
                selected: on.has(id),
                onSelect: () => {
                  if (canWrite) toggle(id)
                },
                seal: mediatorCopy('on'),
                label: mediatorCopy('sceneUnder', { name: condition.name }),
              }}
            />
          )
        })}
      </MiniGrid>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={mediatorCopy('hourPassesTitle', { hour: scene.hours + 1 })}
        confirmLabel={mediatorCopy('anHourPasses')}
        pendingLabel={mediatorCopy('hourPassing')}
        onConfirm={passHour}
        body={
          <>
            <p>{mediatorCopy('hourPassesLede')}</p>
            {steps.length === 0 ? (
              <p>{mediatorCopy('nobodyExposed')}</p>
            ) : (
              <ul style={LIST} aria-label={mediatorCopy('exposed')}>
                {steps.map((step, i) => (
                  // Named by the words beside it, never a hand-rolled <label> (R16).
                  <li key={step.key} style={ROW}>
                    <Checkbox
                      id={`${id}-${i}`}
                      checked={!sheltered.has(step.key)}
                      aria-labelledby={`${id}-${i}-label`}
                      hitArea
                      onChange={() => {
                        const next = new Set(sheltered)
                        if (next.has(step.key)) next.delete(step.key)
                        else next.add(step.key)
                        setSheltered(next)
                      }}
                    />
                    <span id={`${id}-${i}-label`}>
                      {mediatorCopy('exposedLine', {
                        label: step.label,
                        from: step.cost.from.join(', '),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        }
      />
    </>
  )
}
