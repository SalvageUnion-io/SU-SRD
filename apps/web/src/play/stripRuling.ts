/**
 * The owner's ruling on the table's notices (r6 A1), in one place to switch.
 *
 * - `'strip'` (recommended, built): one strip of fixed height under the Play
 *   bar on every seat, the newest item first, "N more" opening in place over
 *   the screen, holding its height while the Game's session is live, so
 *   nothing jumps when an item arrives or leaves.
 * - `'lines'`: the banners stay separate, each cut to one line (its title and
 *   controls), stacked; the page still moves when one arrives or leaves.
 */
export const NOTICE_LAYOUT: 'strip' | 'lines' = 'strip'
