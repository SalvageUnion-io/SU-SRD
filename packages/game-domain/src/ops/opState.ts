/**
 * An op's lifecycle (ADR-063): applied, a proposal still waiting on its
 * answer, or one turned down. A proposal a newer one replaced is declined
 * and names it (`supersededBy`); "Superseded" is how a read shows that.
 */
export const OP_STATES = ['applied', 'proposed', 'declined'] as const
export type OpState = (typeof OP_STATES)[number]
