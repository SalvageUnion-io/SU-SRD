/**
 * The device's note that a session is on it: the Convex account id, written
 * when the Worker's token endpoint answers signed in and removed when it
 * answers signed out or the player signs out (`./session.ts`).
 *
 * The session itself is an HttpOnly cookie no script can read, so this is
 * what an offline boot (`deviceCopy`'s `sessionAccount`) and the SRD's bar
 * (`accountHint`) read instead. A hint, never a credential: the server checks
 * the cookie. Dependency-free, for the SRD's client entry.
 */

export const SESSION_KEY = 'su:session'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The account whose session is on the device, or `null`. */
export function storedSessionAccount(store: Pick<Storage, 'getItem'> | null): string | null {
  try {
    return store?.getItem(SESSION_KEY) || null
  } catch {
    return null
  }
}

export function writeStoredSession(store: Store | null, account: string | null): void {
  try {
    if (account === null) store?.removeItem(SESSION_KEY)
    else store?.setItem(SESSION_KEY, account)
  } catch {
    // Blocked storage: an offline boot then reads as signed out.
  }
}
