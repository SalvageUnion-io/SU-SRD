/**
 * Who is signed in, as the SRD's client entry sees it: the half of the account
 * bar (`accountBar.ts`) that runs on every page. Import-free on purpose:
 * the client entry loads it on every page, and `accountBar.ts`'s links pull
 * in the site constants and, through them, the reference package.
 */

/** Set on `<html>` while somebody is signed in. */
const SIGNED_IN_ATTRIBUTE = 'data-srd-signed-in'

/** This origin's `localStorage`, or null where there is none or it is blocked. */
export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Some browsers throw on the property itself when site data is blocked;
    // with no storage there is no hint, and the bar shows Sign in.
    return null
  }
}

/** Marks `doc` signed in or out. */
export function markSignedIn(doc: Document, signedIn: boolean): void {
  doc.documentElement.toggleAttribute(SIGNED_IN_ATTRIBUTE, signedIn)
}

/** The home's link to the Game last opened (`HomeFront`), served hidden. */
const LAST_GAME_ATTRIBUTE = 'data-last-game'

/**
 * Names the Game last opened on the home's welcome-back strip and points its
 * link at it (`hrefFor`, the app's Game route); with none remembered the link
 * stays out, and Games is the way in.
 */
export function markLastGame(
  doc: Document,
  game: { id: string; name: string } | null,
  hrefFor: (gameId: string) => string
): void {
  for (const link of doc.querySelectorAll<HTMLAnchorElement>(`a[${LAST_GAME_ATTRIBUTE}]`)) {
    link.hidden = game === null
    if (!game) continue
    link.textContent = game.name
    link.href = hrefFor(game.id)
  }
}
