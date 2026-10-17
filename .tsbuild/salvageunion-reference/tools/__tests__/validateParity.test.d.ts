/**
 * Rules-parity audit (ADR-029 §5).
 *
 * Fixture-driven: the detector's BEHAVIOUR is asserted against synthetic
 * records, so these tests keep passing as real content is encoded. A test that
 * asserted "Beefcake is unencoded" would have to be rewritten the moment the
 * backlog was worked off — which is exactly when a regression test matters most.
 */
export {};
