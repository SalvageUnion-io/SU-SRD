/**
 * The account hint: who is signed in, as the Union bar shows them, left in the
 * browser by The Cantina for the SRD to read.
 *
 * The SRD has no backend and opens no Convex connection, yet its bar shows the
 * same account menu as The Cantina's. Both sites share one origin
 * (salvageunion.io, The Cantina at `/build`, ADR-048), so they share
 * `localStorage`: The Cantina writes the display name and avatar here whenever
 * `api.account.me` answers, and clears them on sign-out. It is the one
 * account value kept on the device (the no-device-cache rule's exception): a
 * name and a picture URL, never a record.
 *
 * A hint alone is not trusted. Convex Auth keeps its refresh token in the same
 * storage and removes it on sign-out and on a refresh the server refuses, so
 * the hint counts only while such a token is present: a session that ended
 * anywhere shows signed out here too.
 *
 * The library holds the contract, not the storage (ADR-010): each app passes
 * its own `localStorage`, or null where there is none. Dependency-free on
 * purpose: the SRD's client entry imports it through the
 * `component-lib/accountHint` subpath on every page without pulling in React.
 */

/** The `localStorage` key. */
export const ACCOUNT_HINT_KEY = 'su:account'

/** Convex Auth's refresh-token key, before its `_<deployment>` suffix. */
const REFRESH_TOKEN_PREFIX = '__convexAuthRefreshToken_'

export type AccountHint = {
  name: string | null
  avatarUrl: string | null
}

function hasSession(storage: Storage): boolean {
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (key?.startsWith(REFRESH_TOKEN_PREFIX) && storage.getItem(key)) return true
  }
  return false
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/** Who is signed in, or null when nobody is (or the hint cannot be read). */
export function readAccountHint(storage: Storage | null): AccountHint | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(ACCOUNT_HINT_KEY)
    if (raw === null || !hasSession(storage)) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { name, avatarUrl } = parsed as Record<string, unknown>
    return { name: textOrNull(name), avatarUrl: textOrNull(avatarUrl) }
  } catch {
    // A malformed hint or blocked storage reads as signed out; the bar then
    // offers Sign in, which is right either way.
    return null
  }
}

/** Records who is signed in. */
export function writeAccountHint(hint: AccountHint, storage: Storage | null): void {
  try {
    storage?.setItem(ACCOUNT_HINT_KEY, JSON.stringify(hint))
  } catch {
    // Full or blocked storage: the SRD shows Sign in, the honest fallback.
  }
}

/** Forgets who was signed in. */
export function clearAccountHint(storage: Storage | null): void {
  try {
    storage?.removeItem(ACCOUNT_HINT_KEY)
  } catch {
    // Blocked storage held no hint to clear.
  }
}
