/**
 * A Downtime step's op id (ADR-063 §6): one per Downtime, pilot and step, so
 * applying a step twice (a reload, Undo, the Mediator's Back, a second tab)
 * is a no-op. A Downtime is named by its run (a room's `runId`; on Convex,
 * when it began), so the next one applies its steps afresh.
 */

const PREFIX = 'downtime:'

export function downtimeStepOpId(run: number | string, pilotId: string, stepIndex: number): string {
  return `${PREFIX}${run}:${pilotId}:${stepIndex}`
}

/** A step op is kept even when it changes nothing: Skip and Mark done still take the step. */
export function isDowntimeStepOp(opId: string): boolean {
  return opId.startsWith(PREFIX)
}
