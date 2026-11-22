/**
 * The account hint: who is signed in, as the Union bar shows them, left in the
 * browser by the app for the SRD to read.
 *
 * The SRD has no backend and opens no room connection, yet its bar shows the
 * same account menu as the app's. Both sites share one origin
 * (salvageunion.io, the app at `/build`, ADR-048), so they share
 * `localStorage`: the app writes the display name and avatar here whenever
 * `api.account.me` answers, and clears them on sign-out. It is the one
 * account value the SRD reads from the device: a name and a picture URL, never
 * a record (the app's records are the device copy's, ADR-058).
 *
 * A hint alone is not trusted. The app keeps the device's stored session in the
 * same storage and removes it on sign-out and whenever the Worker answers
 * signed out (`auth/storedSession.ts`), so the hint counts only while it
 * is present: a session that ended anywhere shows signed out here too.
 *
 * Beside it, the LAST GAME the reader opened (`su:last-game`: its id and its
 * name), so the home's welcome-back strip can name it and link straight to it.
 * The same trust rule holds: it counts only while a session is stored, and it
 * is forgotten with the account hint.
 *
 * The library holds the contract, not the storage (ADR-010): each app passes
 * its own `localStorage`, or null where there is none. Dependency-free on
 * purpose: the SRD's client entry imports it on every page without pulling
 * in React.
 */

/** The `localStorage` key. */
export const ACCOUNT_HINT_KEY = 'su:account'

/**
 * The stored session's key (`auth/storedSession.ts`'s `SESSION_KEY`), spelt
 * here rather than imported: an import gives every SRD page a chunk of its
 * own to load. A test holds the two together.
 */
export const STORED_SESSION_KEY = 'su:session'

export type AccountHint = {
  name: string | null
  avatarUrl: string | null
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/** Who is signed in, or null when nobody is (or the hint cannot be read). */
export function readAccountHint(storage: Storage | null): AccountHint | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(ACCOUNT_HINT_KEY)
    if (raw === null || !storage.getItem(STORED_SESSION_KEY)) return null
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

/** The `localStorage` key of the last Game opened. */
export const LAST_GAME_KEY = 'su:last-game'

export type LastGameHint = { id: string; name: string }

/** The last Game the signed-in reader opened, or null (nobody signed in, none opened, unreadable). */
export function readLastGame(storage: Storage | null): LastGameHint | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(LAST_GAME_KEY)
    if (raw === null || !storage.getItem(STORED_SESSION_KEY)) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { id, name } = parsed as Record<string, unknown>
    const [gameId, gameName] = [textOrNull(id), textOrNull(name)]
    return gameId && gameName ? { id: gameId, name: gameName } : null
  } catch {
    return null
  }
}

/** Records the Game the reader has open. */
export function writeLastGame(game: LastGameHint, storage: Storage | null): void {
  try {
    storage?.setItem(LAST_GAME_KEY, JSON.stringify({ id: game.id, name: game.name }))
  } catch {
    // Full or blocked storage: the home names no Game, and still links to Games.
  }
}

/**
 * The Game the home names on a device (r3 I4): the one last opened here while
 * the account is still in it, under its current name; else the first of the
 * account's Games, so a phone that has only signed in names one too. Null
 * with no Games: Games stays the way in.
 */
export function lastGameAmong(
  remembered: LastGameHint | null,
  games: readonly LastGameHint[]
): LastGameHint | null {
  return games.find((game) => game.id === remembered?.id) ?? games[0] ?? null
}

/** Forgets who was signed in, and the Game they last opened. */
export function clearAccountHint(storage: Storage | null): void {
  try {
    storage?.removeItem(ACCOUNT_HINT_KEY)
    storage?.removeItem(LAST_GAME_KEY)
  } catch {
    // Blocked storage held no hint to clear.
  }
}
