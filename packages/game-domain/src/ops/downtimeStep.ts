/**
 * A Downtime step's op id (ADR-063 §6): one per Downtime, pilot and step, so
 * applying a step twice (a reload, Undo, the Mediator's Back, a second tab)
 * is a no-op. A Downtime is named by its run (`runId`), so the next one
 * applies its steps afresh.
 */

const PREFIX = 'downtime:'

export function downtimeStepOpId(run: string, pilotId: string, stepIndex: number): string {
  return `${PREFIX}${run}:${pilotId}:${stepIndex}`
}

/**
 * Restore's healing run again for a pilot who took the step before their
 * crawler had a Med Bay (r5 A12): its own op, once per run, pilot and step.
 */
export function downtimeHealOpId(run: string, pilotId: string, stepIndex: number): string {
  return `${downtimeStepOpId(run, pilotId, stepIndex)}:heal`
}

/** What a Downtime does once to its crawler, in its own step: pay the Upkeep, process the Nanites. */
export type DowntimeClaim = 'upkeep' | 'nanites'

/** The crawler op that pays a run's Upkeep or processes its Nanites, once per Downtime. */
export function downtimeClaimOpId(run: string, claim: DowntimeClaim): string {
  return `${PREFIX}${run}:${claim}`
}

/** A step op is kept even when it changes nothing: Skip and Mark done still take the step. */
export function isDowntimeStepOp(opId: string): boolean {
  return opId.startsWith(PREFIX)
}
