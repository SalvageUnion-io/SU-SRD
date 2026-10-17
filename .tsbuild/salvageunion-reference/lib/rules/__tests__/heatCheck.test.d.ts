/**
 * Heat Check / Reactor Overload rule tests.
 *
 * The d20 is INJECTABLE via the `roll` param, so every test is deterministic —
 * no real randomness. We build a `seqRoll` helper that returns a scripted
 * sequence of rolls (first call = Heat Check d20, second = Reactor Overload d20).
 */
export {};
