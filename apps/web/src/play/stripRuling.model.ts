/**
 * The owner's ruling on the table's notices (r6 A1), in one place to switch.
 *
 * - `'strip'` (recommended, built): one strip of fixed height under the Play
 *   bar on every seat, the newest item first, "N more" opening below it
 *   (r7 A1); with nothing to say it takes no room (r7 A2).
 * - `'lines'`: the banners stay separate, each cut to one line (its title and
 *   controls), stacked; the page still moves when one arrives or leaves.
 */
export const NOTICE_LAYOUT: 'strip' | 'lines' = 'strip'

/**
 * What the strip pins (r8 A2, ruled): `'act'` (recommended, built) pins only
 * what the seat must act on or know at once: a proposal, the Mediator's
 * alert, "Your turn" and a unit Down. Routine events (a session starting,
 * the initiative roll, a turn ending, Downtime moving, who mediates, who is
 * up) write a Feed line and nothing else. `'news'` is the earlier choice:
 * each of those pins the strip as news too.
 */
export const STRIP_PINS: 'act' | 'news' = 'act'
