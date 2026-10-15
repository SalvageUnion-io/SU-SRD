/**
 * The Union bar's account controls on the SRD, which has no backend: who is
 * signed in comes from the account hint The Cantina leaves on this origin
 * (`component-lib/accountHint`).
 *
 * The page is served signed out — one HTML for every reader, so no cache ever
 * holds anyone's name. The client entry reads the hint once per load and marks
 * the document; the stylesheet then hides Sign in, and the account islands
 * (`data-when="signed-in"`) mount the shared `AccountMenu`. Signed out, they
 * never mount, so a reader who never signed in loads no React for them.
 */

import { CANTINA_URL } from './constants'

/** Set on `<html>` while somebody is signed in. */
const SIGNED_IN_ATTRIBUTE = 'data-srd-signed-in'

/** Where Sign in goes: The Cantina starts Discord's round trip (`/sign-in`). */
export const SIGN_IN_HREF = `${CANTINA_URL}sign-in`

/** The Cantina's settings page. */
export const SETTINGS_HREF = `${CANTINA_URL}settings`

/** The Cantina ends the session, then comes back to `page` (`/sign-out`). */
export function signOutHref(page: string): string {
  return `${CANTINA_URL}sign-out?to=${encodeURIComponent(page)}`
}

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
