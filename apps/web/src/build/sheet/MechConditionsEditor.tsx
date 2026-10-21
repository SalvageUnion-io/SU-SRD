/**
 * MechConditionsEditor — the mech's unified conditions editor.
 *
 * Renders ONE list — `unifiedMechConditions()` (free-form `conditions[]`
 * merged with the automation-written shutdown/vulnerable/destroyed flags) —
 * through the one chip-well editor (`ChipListEditor`). Edits map back through
 * `mechConditionsPatch`: removing 'Shutdown' / 'Vulnerable' / 'Destroyed'
 * clears the boolean flag (the manual clear), everything else round-trips
 * `conditions[]`. The two storage forms can never disagree on screen.
 */

import type { Mech } from 'game-domain/schemas/mech'
import { unifiedMechConditions } from 'salvageunion-reference/rules'
import { mechConditionsPatch } from '../../lib/rules/mechItems'
import { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import { ChipListEditor } from './ChipListEditor'
import { CONDITION_DRAFT } from './chipWell.model'
import { freshEntity } from './freshEntity.model'

type MechConditionsEditorProps = {
  mech: Mech
  /** Injectable store — defaults to useEntityStore. */
  store?: typeof useEntityStore
}

export function MechConditionsEditor({ mech, store = useEntityStore }: MechConditionsEditorProps) {
  const storeState = store()

  async function handleChange(next: string[]) {
    // Freshest record from the store so rapid edits don't stomp each other.
    const fresh = freshEntity(storeState, 'mech', mech)
    await storeState.update('mech', mech.id, mechConditionsPatch(fresh, next), LIVE_SHEET_MANUAL)
  }

  return (
    <ChipListEditor
      items={unifiedMechConditions(mech)}
      onChange={handleChange}
      noun="condition"
      draftWidth={CONDITION_DRAFT}
      unique
    />
  )
}
