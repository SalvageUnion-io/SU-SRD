import type { SURefChassis } from 'salvageunion-reference'
import {
  extractPilotActions,
  extractMechActions,
  extractChassisActions,
  extractComradeActions,
  getGeneralActions,
} from './pilotActionUtils'
import type { ActionDisplayData } from './pilotActionUtils'
import type { ComradeEntry } from './comradeUtils'
import type { EntityRefRow } from '../types/common'

export type AggregateActionsInput = {
  pilotRefs: EntityRefRow[]
  isBoarded: boolean
  comrades: ComradeEntry[]
  mechRefs?: EntityRefRow[]
  mechChassis?: SURefChassis
}

export type AggregateActionsResult = {
  allActions: ActionDisplayData[]
  comradeEntityIds: Set<string>
}

/**
 * Aggregate all action sources into a single pool.
 *
 * Pure function (no hooks, no side effects) that calls the extract*
 * helpers and merges pilot, mech, chassis, comrade, and general actions.
 *
 * Comrade name overrides are NOT applied here — callers that need
 * custom comrade names should map over the returned actions separately.
 */
export function aggregateActions(input: AggregateActionsInput): AggregateActionsResult {
  const { pilotRefs, isBoarded, comrades, mechRefs, mechChassis } = input

  const comradeEntityIds = new Set(comrades.map((c) => c.entity.id))

  const pilotActions = extractPilotActions(pilotRefs, isBoarded)

  const mechActions =
    mechRefs && mechRefs.length > 0 ? extractMechActions(mechRefs, isBoarded, comradeEntityIds) : []

  const chassisActions = mechChassis ? extractChassisActions(mechChassis, isBoarded) : []

  const comradeActions = extractComradeActions(comrades, isBoarded, mechRefs)

  const generalActions = getGeneralActions(isBoarded)

  const allActions = [
    ...pilotActions,
    ...mechActions,
    ...chassisActions,
    ...comradeActions,
    ...generalActions,
  ]

  return { allActions, comradeEntityIds }
}
