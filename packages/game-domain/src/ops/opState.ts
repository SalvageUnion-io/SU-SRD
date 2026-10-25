/**
 * An op's lifecycle (ADR-063): applied, a proposal still waiting on its
 * answer, or one turned down. A leaf module, so Convex's schema can read it.
 */
export const OP_STATES = ['applied', 'proposed', 'declined'] as const
export type OpState = (typeof OP_STATES)[number]
