/**
 * useTidyUp — the boxes of the one tidy step (r6 C2, `tidyUp.model.ts`) for a
 * dialog that changes the phase (Begin Downtime, End group session): the
 * running encounter, its field and the Scene conditions, each a box, ticked
 * once the fight is over. `reset` when the dialog opens; `run` does what is
 * ticked, before the dialog's own act. Nothing for anyone but the Mediator,
 * who alone is served the encounter and the field.
 */

import type { ReactNode } from 'react'
import { useState } from 'react'
import { Checkbox } from '../components/index'
import { playTidyCopy } from '../messages/play-tidy'
import { useTableAct, useTableRead } from '../replica/useTable'
import type { TidyKey } from './tidyUp.model'
import { tidyPlan, trayRowDown } from './tidyUp.model'
import { sceneConditionNames, useScene } from './useScene'

export function useTidyUp(gameId: string | null) {
  const args = gameId === null ? 'skip' : { gameId }
  const running = useTableRead('mediator.running', args) ?? null
  const field = useTableRead('mediator.npcs', args) ?? []
  const scene = useScene(gameId)
  const endEncounter = useTableAct('mediator.endEncounter', gameId)
  const clearTray = useTableAct('mediator.clearTray', gameId)
  const setConditions = useTableAct('scenes.setConditions', gameId)
  const plan = tidyPlan(
    {
      running: running?.name ?? null,
      field: field.map((row) => trayRowDown((row as { body?: unknown }).body)),
      conditions: sceneConditionNames(scene.conditions),
    },
    {
      endEncounter: (name) => playTidyCopy('endEncounter', { name }),
      clearTheDowned: playTidyCopy('clearTheDowned'),
      clearTheField: (standing) => playTidyCopy('clearTheField', { count: standing }),
      endConditions: (names) => playTidyCopy('endConditions', { names }),
    }
  )
  const [ticked, setTicked] = useState<readonly TidyKey[]>([])
  const on = (key: TidyKey) => ticked.includes(key)
  const boxes: ReactNode =
    plan.choices.length === 0
      ? null
      : plan.choices.map((choice) => (
          // The words name the tick and toggle it (`Checkbox words`, R16).
          <Checkbox
            key={choice.key}
            checked={on(choice.key)}
            onChange={(e) =>
              setTicked((now) =>
                e.target.checked ? [...now, choice.key] : now.filter((k) => k !== choice.key)
              )
            }
            words={choice.label}
          />
        ))
  return {
    boxes,
    /** The dialog opened: the boxes start as the fight left them. */
    reset: () => setTicked(plan.ticked),
    /** Do what is ticked; the dialog's own act follows. */
    run: async () => {
      if (on('encounter')) await endEncounter({ clear: on('field') })
      else if (on('field')) await clearTray(undefined as never)
      if (on('scene')) await setConditions({ conditions: [] })
    },
  }
}
