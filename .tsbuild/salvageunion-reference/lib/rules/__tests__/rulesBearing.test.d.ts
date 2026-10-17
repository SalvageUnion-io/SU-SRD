/**
 * Claim detection (ADR-029) — shared by the parity audit and the entity card.
 *
 * The timing test is not incidental. These patterns began life in a build-time
 * tool over fixed data; C4 moved them into the RENDER path, where they run on
 * every paragraph and content-controlled whitespace becomes a denial-of-service
 * surface. CodeQL flagged the original as `js/polynomial-redos`, correctly.
 */
export {};
