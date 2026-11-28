/**
 * The owner's rulings on round six's Downtime fixes, each one switch, read by
 * both the rooms and the app so a ruling changes in this one place.
 */

/**
 * r6 D1, who moves a pilot's carried Scrap to the crawler in Tally Salvage
 * (Core Book p.227).
 *  - `'each-player'` (recommended): each player presses Move to the crawler
 *    for their own pilot; nothing writes to a player's sheet but its player
 *    ("propose, never impose").
 *  - `'mediator-at-upkeep'`: the Mediator's Next from Tally Salvage moves
 *    every pilot's Scrap at once, writing to the players' sheets.
 */
export type ScrapMoveRuling = 'each-player' | 'mediator-at-upkeep'

/**
 * r6 D5, where crafting spends Scrap (Core Book p.222).
 *  - `'play-only'` (recommended): only Play's Downtime craft step spends
 *    Scrap; the Live Sheet's Manage Systems stays free hand-editing
 *    (surfaces §2).
 *  - `'play-and-sheet'`: Manage Systems would offer Spend Scrap too. Not
 *    built: it is a Live Sheet control (`build/sheet/`).
 */
export type CraftSpendRuling = 'play-only' | 'play-and-sheet'

export const DOWNTIME_RULINGS: {
  readonly scrapMove: ScrapMoveRuling
  readonly craftSpends: CraftSpendRuling
} = {
  scrapMove: 'each-player',
  craftSpends: 'play-only',
}
