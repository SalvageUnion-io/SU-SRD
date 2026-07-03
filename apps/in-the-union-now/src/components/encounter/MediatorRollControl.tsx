/**
 * MediatorRollControl — Reaction / Morale / Retreat roll buttons + a last-
 * result readout (design-review R-5; Workshop Manual p.268), in the
 * HeatCheckControl surface style.
 *
 * ADR-007: these tables carry no mechanical bookkeeping — the result is
 * recorded (via `onResult`, so the caller decides where it persists) and the
 * table acts on the narrative outcome by hand.
 *
 * The d20 and the roll-table lookup are dep-injectable so tests are
 * deterministic and need no preloaded reference data.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import { Btn, MiniBtn } from 'suref-react'

import { defaultRoll } from '../../lib/rules/heatCheck'
import type { Roll } from '../../lib/rules/heatCheck'
import {
  MEDIATOR_TABLE_LABEL,
  describeMediatorRoll,
  performMediatorRoll,
} from '../../lib/rules/mediatorTables'
import type { FindRollTable } from '../../lib/rules/mediatorTables'
import type { MediatorRollResult, MediatorTableId } from '../../lib/schemas/encounterNpc'

const TABLE_IDS: readonly MediatorTableId[] = ['reaction', 'morale', 'retreat']

const TABLE_HINT: Record<MediatorTableId, string> = {
  reaction: 'How do the NPCs react when first met?',
  morale: 'At 50% or less HP/SP (or 50%+ group losses): do the NPCs stay in the fight?',
  retreat: 'A group chooses to retreat: how does the escape go?',
}

/** Production table lookup — defensive so unloaded data reads as a miss. */
const defaultFindTable: FindRollTable = (name) => {
  try {
    return SalvageUnionReference.RollTables.find((t) => t.name === name)
  } catch {
    return undefined
  }
}

type MediatorRollControlProps = {
  /** Disambiguates button aria-labels when several controls render at once. */
  scopeLabel: string
  /** The recorded last result to display (caller-owned state). */
  lastResult?: MediatorRollResult | null
  /** Receives each roll result — caller persists (per NPC) or holds it (global). */
  onResult: (result: MediatorRollResult) => void | Promise<void>
  /** Compact MiniBtn row for per-NPC embedding; full Btn row otherwise. */
  compact?: boolean
  /** Injectable d20 roller — defaults to a randsum-backed roll. */
  roll?: Roll
  /** Injectable roll-table lookup — defaults to SalvageUnionReference. */
  findTable?: FindRollTable
}

export function MediatorRollControl({
  scopeLabel,
  lastResult,
  onResult,
  compact = false,
  roll = defaultRoll,
  findTable = defaultFindTable,
}: MediatorRollControlProps) {
  function handleRoll(table: MediatorTableId) {
    const result = performMediatorRoll({ table, roll, findTable })
    if (result === null) return
    void onResult(result)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TABLE_IDS.map((table) =>
          compact ? (
            <MiniBtn
              key={table}
              aria-label={`Roll ${MEDIATOR_TABLE_LABEL[table]} for ${scopeLabel}`}
              title={TABLE_HINT[table]}
              onClick={() => handleRoll(table)}
            >
              {MEDIATOR_TABLE_LABEL[table]}
            </MiniBtn>
          ) : (
            <Btn
              key={table}
              size="sm"
              variant="primary"
              aria-label={`Roll ${MEDIATOR_TABLE_LABEL[table]} for ${scopeLabel}`}
              title={TABLE_HINT[table]}
              onClick={() => handleRoll(table)}
            >
              {MEDIATOR_TABLE_LABEL[table]}
            </Btn>
          )
        )}
      </div>

      <div className={compact ? 'mt-1.5' : 'mt-2 min-h-[1.5rem]'}>
        {lastResult && (
          <p
            role="status"
            className={`m-0 font-body text-ink ${compact ? 'text-xs' : 'text-sm'}`}
            data-table={lastResult.table}
            data-roll={lastResult.roll}
          >
            {describeMediatorRoll(lastResult)}
          </p>
        )}
      </div>
    </div>
  )
}
