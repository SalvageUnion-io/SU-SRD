/**
 * The build floor: the oldest client build this backend still accepts. It is
 * raised by hand, and only when a change breaks a tab that is already open.
 *
 * Both sides compile this one number. The backend serves it through
 * `build.floor`. Every bundle also carries the value it was built with
 * (`src/lib/connection/buildFloor.ts`). An open tab whose number is lower than
 * the backend's is outdated: it stops writing and reloads onto the new build.
 * A deploy that leaves the number alone leaves every open tab working. Such a
 * tab picks up the new build on its own, at a moment that interrupts nothing.
 *
 * **Raise it** in the PR whose backend refuses or misreads what an older tab
 * sends or expects. Set it to the current time (`date +%s`), so it is above
 * every value before it. Examples:
 *
 * - a public function is deleted or renamed
 * - an argument becomes required, or a validator narrows (the
 *   `tools/convex-client-contract.json` gate catches these two kinds)
 * - a stored shape changes in a way older code cannot read or would write
 *   wrongly, such as slug-only refs (#1267), which the gate cannot see
 *
 * Never lower it. A value lower than one already deployed would let back in
 * tabs that this backend refuses.
 */
export const BUILD_FLOOR = 1791587077
