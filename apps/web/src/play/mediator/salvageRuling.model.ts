/**
 * The owner's ruling on a wreck's salvage (r7 D8, LG7-19), in one place to switch.
 *
 * - `'crew'` (recommended, built): after the Mediator rolls Mech Salvage, their
 *   pick goes to the table as a proposal (ADR-030 §4 as amended): offered to
 *   the crawler, any member of the crew accepts it, changes it to another
 *   part the roll allows, or declines it; offered to a crew Mech, its holder does.
 * - `'mediator'`: the Mediator's pick goes straight into the crawler's hold,
 *   and the Feed says what was taken (a Mech's hold still takes a proposal).
 */
export const WRECK_SALVAGE: 'crew' | 'mediator' = 'crew'
