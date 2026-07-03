/**
 * MechConditionsEditor — the mech's unified conditions editor (plan 4.5,
 * gap 21 + gap 8).
 *
 * Renders ONE list — `unifiedMechConditions()` (free-form `conditions[]`
 * merged with the automation-written shutdown/vulnerable/destroyed flags) —
 * through the existing ConditionsEditor chips. Edits map back through
 * `mechConditionsPatch`: removing 'Shutdown' / 'Vulnerable' / 'Destroyed'
 * clears the boolean flag (the manual clear), everything else round-trips
 * `conditions[]`. The two storage forms can never disagree on screen.
 */

import { unifiedMechConditions } from '../../lib/rules/derivedStats'
import type { Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { ConditionsEditor } from './ConditionsEditor'
import { mechConditionsPatch } from './mechItemRules'
import { freshEntity } from './controlPrimitives'

type MechConditionsEditorProps = {
  mech: Mech
  /** Injectable store — defaults to useEntityStore. */
  store?: typeof useEntityStore
  readOnly?: boolean
}

export function MechConditionsEditor({
  mech,
  store = useEntityStore,
  readOnly = false,
}: MechConditionsEditorProps) {
  const storeState = store()

  async function handleChange(next: string[]) {
    // Freshest record from the store so rapid edits don't stomp each other.
    const fresh = freshEntity(storeState, 'mech', mech)
    await storeState.update('mech', mech.id, mechConditionsPatch(fresh, next))
  }

  return (
    <ConditionsEditor
      conditions={unifiedMechConditions(mech)}
      onChange={handleChange}
      readOnly={readOnly}
    />
  )
}
