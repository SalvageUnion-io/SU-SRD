/**
 * An op's lifecycle (ADR-063): applied, a proposal still waiting on its
 * answer, one turned down, or one a newer proposal on its field replaced. A
 * leaf module, so Convex's schema can read it.
 */
export const OP_STATES = ['applied', 'proposed', 'declined', 'superseded'] as const
export type OpState = (typeof OP_STATES)[number]
