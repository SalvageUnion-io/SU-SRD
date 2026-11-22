/**
 * The owner's rulings on round six's Training Bay choices, each in one place
 * (r6 E2, E3, E7, E11). Each constant is the Recommended choice; flipping one
 * switches the behaviour it names wherever it is read.
 */

/**
 * E2: "Update the pattern from this Mech" writes the pattern alone. Other
 * Mechs built from it then show their own drift stamp with the same two
 * buttons. (The other choice would also offer to update every linked Mech,
 * which writes to Mechs that may be in Games: not built.)
 */
export const UPDATE_PATTERN_ONLY = true

/**
 * E3: a delete that has an Undo asks nothing first: a Mech, and a pattern
 * (held while its notice shows). `false` keeps the confirm for a pattern,
 * whose shared links stop working for everyone.
 */
export const PATTERN_DELETE_SKIPS_CONFIRM = true

/**
 * E7: Change Chassis keeps the Systems and Modules that will not fit, marked
 * RULE BREAKING (caps are Free Edit's to override). `false` leaves them off,
 * as before, after the preview lists them.
 */
export const CHASSIS_SWAP_KEEPS_OVERFLOW = true

/**
 * E11: every public pattern credits its maker's display name ("Made by"), and
 * Share says so when it is made public. `false` credits only a pattern also
 * shared on the Reference.
 */
export const CREDIT_EVERY_PUBLIC_PATTERN = true
