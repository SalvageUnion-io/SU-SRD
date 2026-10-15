/**
 * The Union bar's account controls on the SRD, which has no backend: who is
 * signed in comes from the account hint The Cantina leaves on this origin
 * (`src/lib/accountHint`).
 *
 * The page is served signed out — one HTML for every reader, so no cache ever
 * holds anyone's name. The client entry reads the hint once per load and marks
 * the document (`accountState.ts`); the stylesheet then hides Sign in, and the account islands
 * (`data-when="signed-in"`) mount the shared `AccountMenu`. Signed out, they
 * never mount, so a reader who never signed in loads no React for them.
 */

import { CANTINA_PATH } from './constants'

/** Where Sign in goes: The Cantina starts Discord's round trip (`/sign-in`). */
export const SIGN_IN_HREF = `${CANTINA_PATH}sign-in`

/** The Cantina's settings page. */
export const SETTINGS_HREF = `${CANTINA_PATH}settings`

/** The Cantina ends the session, then comes back to `page` (`/sign-out`). */
export function signOutHref(page: string): string {
  return `${CANTINA_PATH}sign-out?to=${encodeURIComponent(page)}`
}
