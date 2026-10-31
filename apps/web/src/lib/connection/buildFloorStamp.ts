/**
 * The build floor: the oldest client build the backend still accepts. It is
 * raised by hand, and only when a change breaks a tab that is already open.
 *
 * Both sides compile this one number. The Worker serves it
 * (`ACCOUNT_PATHS.floor`), and every bundle carries the value it was built
 * with (`buildFloor.ts`). An open tab whose number is lower than the
 * Worker's is outdated: it stops writing and reloads onto the new build. A
 * deploy that leaves the number alone leaves every open tab working.
 *
 * **Raise it** in the change whose backend refuses or misreads what an older
 * tab sends or expects: a room act or Worker route removed or renamed, an
 * argument made required, or a stored shape older code cannot read. Set it to
 * the current time (`date +%s`), so it is above every value before it.
 *
 * Never lower it. A value lower than one already deployed would let back in
 * tabs that this backend refuses.
 */
export const BUILD_FLOOR = 1793453664
