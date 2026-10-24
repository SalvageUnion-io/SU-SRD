/**
 * PlayScene — the Scene's conditions on a player's screen (play.md §5): a
 * Slab, "Scene" with the hour, then each condition the Mediator has put the
 * Scene under as a Mini of its keyword (a Radiation Storm, Freezing, Low
 * Visibility), its Peek the rules text. A condition that changes the Heat a
 * Mech gains says by how much (`HEAT | ×2`); Low Visibility says Close only.
 * Nothing when the Scene is clear, or solo.
 *
 * `SceneConditionMini` is the one Mini for a condition, the Mediator's list
 * too (`PlayMediatorScene`), where it is a toggle.
 */

import type { SceneCondition } from 'game-domain/rules/sceneConditions'
import { sceneConditionsOf } from 'game-domain/rules/sceneConditions'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntityMode } from '../components/entity/types'
import { Entity, MiniGrid, Slab, Stat } from '../components/index'
import { playCopy } from '../messages/play'
import type { SceneState } from './useScene'

/** The Heat multiplier as the chip reads it: ×2, ×½. */
function heatScaleText(scale: number): string {
  return scale === 0.5 ? '×½' : `×${scale}`
}

/** What a condition does to the numbers on the seat, as its state chips. */
function conditionChips(condition: SceneCondition): ReactNode {
  if (condition.heatScale !== 1) {
    return (
      <Stat
        key="scene"
        size="mini"
        label={playCopy('heat')}
        value={heatScaleText(condition.heatScale)}
      />
    )
  }
  if (condition.closeRangeOnly)
    return <Stat key="scene" size="mini" label={playCopy('closeOnly')} />
  return null
}

export function SceneConditionMini({
  condition,
  mode,
}: {
  condition: SceneCondition
  mode?: EntityMode
}) {
  const keyword = SalvageUnionReference.Keywords.getById(condition.keyword)
  if (keyword === undefined) return null
  const state = conditionChips(condition)
  return (
    <li data-condition={condition.id} {...(mode ? { 'data-choice-toggle': '' } : {})}>
      <Entity
        size="mini"
        context="play"
        entity={keyword}
        {...(mode ? { mode } : {})}
        {...(state === null ? {} : { state })}
      />
    </li>
  )
}

export function PlayScene({ scene }: { scene: SceneState }) {
  const conditions = sceneConditionsOf(scene.conditions)
  if (conditions.length === 0) return null
  return (
    <>
      <Slab
        as="h2"
        label={playCopy('scene')}
        {...(scene.hours > 0 ? { count: { label: playCopy('hour'), value: scene.hours } } : {})}
      />
      <MiniGrid label={playCopy('sceneConditions')} play>
        {conditions.map((c) => (
          <SceneConditionMini key={c.id} condition={c} />
        ))}
      </MiniGrid>
    </>
  )
}
