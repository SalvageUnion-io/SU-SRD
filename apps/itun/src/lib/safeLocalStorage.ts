/**
 * The one way this app touches `localStorage`.
 *
 * ## Why a helper rather than the global
 *
 * `localStorage` fails in three unrelated ways, and hand-rolled access tends to
 * guard against one of them:
 *
 *  - **It may not exist.** Anything that runs outside a browser (a Bun test, a
 *    prerender, a worker) has no `localStorage` binding at all. Reaching for a
 *    global that was never declared throws `ReferenceError` — which a bare
 *    `try` around a *later* line does not catch, because the throw happens on
 *    evaluation.
 *  - **It may exist and refuse.** Safari private mode and a full quota both
 *    throw on `setItem`.
 *  - **It may hold nonsense.** The value came from a previous build, another
 *    tab, or the user's own devtools.
 *
 * The five modules that used it each solved some subset with a different shape
 * — a `typeof` check inside a `try`, a separate `storageAvailable()` predicate,
 * or (in one case) a bare `try` with no `typeof` guard at all, the one variant
 * that throws `ReferenceError` instead of returning a fallback. Converging them
 * means the guard is correct once instead of nearly-correct five times.
 *
 * ## Contract
 *
 * Every operation is best-effort and total: reads return `null` when anything
 * goes wrong, writes report whether they landed and never throw. Persistence
 * here is a convenience — a dial layout, a nudge counter, the current container
 * — so a failure must degrade the preference, never the app.
 */

/**
 * Resolve the backing store, or `null` when there isn't one.
 *
 * `typeof` rather than a truthiness check on the identifier: only `typeof` is
 * safe against a binding that was never declared. Resolved per call rather than
 * cached at module load, because module evaluation can precede the environment
 * being ready (SSR, a test that installs a stub after import).
 */
function backing(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    // Some embedders throw on the *property access* itself when storage is
    // disabled by policy, rather than leaving it undefined.
    return null
  }
}

/** Read a key. `null` for absent, unavailable, or throwing storage. */
export function readLocal(key: string): string | null {
  const store = backing()
  if (store === null) return null
  try {
    return store.getItem(key)
  } catch {
    return null
  }
}

/** Write a key. Returns whether it landed; never throws. */
export function writeLocal(key: string, value: string): boolean {
  const store = backing()
  if (store === null) return false
  try {
    store.setItem(key, value)
    return true
  } catch {
    // Quota exceeded, or private mode refusing to persist.
    return false
  }
}

/**
 * Deliberately no `removeLocal` / `isLocalStorageAvailable` yet. The two
 * remaining hand-rolled callers (`backupNudge.ts`, `publishedSnapshots.ts`)
 * need them and are owned elsewhere, and the dead-code gate treats an export
 * with no consumer as dead. Add them here — same `backing()` + `try` shape as
 * above — in the change that converts those modules, not before.
 */

/**
 * Read and `JSON.parse` a key, with `null` for anything that does not survive
 * the round trip — absent, unavailable, or malformed.
 *
 * The parse is deliberately here rather than at each call site: stored JSON is
 * untrusted input (a previous build wrote it, or the user edited it), and a
 * `SyntaxError` escaping into a store initializer would take down the app at
 * import time. Callers still have to validate the *shape* — this only promises
 * the string was JSON.
 */
export function readLocalJson(key: string): unknown {
  const raw = readLocal(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** `JSON.stringify` and write. Returns whether it landed; never throws. */
export function writeLocalJson(key: string, value: unknown): boolean {
  try {
    return writeLocal(key, JSON.stringify(value))
  } catch {
    // A value with a circular reference or a throwing toJSON.
    return false
  }
}
